(() => {
  let currentVoicingMidi = [];
  let currentApproachMidi = [];
  let isApproaching = false;
  let pianoSampler = null;
  let audioPromise = null;
  let vexPromise = null;

  const noteToPC = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
  const pcToNoteSharp = {0:'C',1:'C#',2:'D',3:'D#',4:'E',5:'F',6:'F#',7:'G',8:'G#',9:'A',10:'A#',11:'B'};
  const pcToNoteFlat = {0:'C',1:'Db',2:'D',3:'Eb',4:'E',5:'F',6:'Gb',7:'G',8:'Ab',9:'A',10:'Bb',11:'B'};
  const chordFormulas = {
    Maj7:[0,4,7,11], '7':[0,4,7,10], m7:[0,3,7,10], m7b5:[0,3,6,10],
    dim7:[0,3,6,9], Maj6:[0,4,7,9], m6:[0,3,7,9]
  };

  function loadScript(src, test) {
    return new Promise((resolve, reject) => {
      if (test()) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureVex() {
    if (window.Vex) return;
    if (!vexPromise) vexPromise = loadScript('https://unpkg.com/vexflow@3.0.9/releases/vexflow-min.js', () => !!window.Vex);
    return vexPromise;
  }

  async function ensureAudio() {
    if (pianoSampler) { await Tone.start(); return; }
    if (audioPromise) return audioPromise;
    audioPromise = (async () => {
      const btn = document.getElementById('btn-play-voicing');
      const original = btn.textContent;
      btn.textContent = 'Loading audio…';
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js', () => !!window.Tone);
      await Tone.start();
      pianoSampler = new Tone.Sampler({
        urls: {A0:'A0.mp3',C1:'C1.mp3','D#1':'Ds1.mp3','F#1':'Fs1.mp3',A1:'A1.mp3',C2:'C2.mp3','D#2':'Ds2.mp3','F#2':'Fs2.mp3',A2:'A2.mp3',C3:'C3.mp3','D#3':'Ds3.mp3','F#3':'Fs3.mp3',A3:'A3.mp3',C4:'C4.mp3','D#4':'Ds4.mp3','F#4':'Fs4.mp3',A4:'A4.mp3',C5:'C5.mp3','D#5':'Ds5.mp3','F#5':'Fs5.mp3',A5:'A5.mp3',C6:'C6.mp3','D#6':'Ds6.mp3','F#6':'Fs6.mp3',A6:'A6.mp3',C7:'C7.mp3','D#7':'Ds7.mp3','F#7':'Fs7.mp3',A7:'A7.mp3',C8:'C8.mp3'},
        release: 1,
        volume: -6,
        baseUrl: 'https://tonejs.github.io/audio/salamander/'
      }).toDestination();
      await Tone.loaded();
      btn.textContent = original;
    })().catch((err) => {
      audioPromise = null;
      console.error(err);
      throw err;
    });
    return audioPromise;
  }

  function getMidi(note, acc, oct) {
    let pc = noteToPC[note];
    if (acc === '#') pc++;
    if (acc === 'b') pc--;
    return (parseInt(oct, 10) + 1) * 12 + pc;
  }

  function calculate4WayClose(targetMidi, chordRootPC, chordType, preferFlats) {
    const chordTonesPC = chordFormulas[chordType].map((i) => (chordRootPC + i + 12) % 12);
    const melodyPC = targetMidi % 12;
    let effectiveMelodyPC = melodyPC;
    let subMessage = '';

    if (!chordTonesPC.includes(melodyPC)) {
      let lowestDist = 12;
      let replaceIndex = -1;
      chordTonesPC.forEach((tone, i) => {
        const dist = (melodyPC - tone + 12) % 12;
        if (dist > 0 && dist < lowestDist) { lowestDist = dist; replaceIndex = i; }
      });
      if (replaceIndex !== -1) {
        const noteMap = preferFlats ? pcToNoteFlat : pcToNoteSharp;
        subMessage = `Melody is a tension. Substituted for ${noteMap[chordTonesPC[replaceIndex]]} when building the close voicing.`;
        effectiveMelodyPC = chordTonesPC[replaceIndex];
      }
    }

    const voicingMidi = [targetMidi];
    let currentMidi = targetMidi;
    for (let i = 0; i < 3; i++) {
      while (true) {
        currentMidi--;
        if (chordTonesPC.includes((currentMidi % 12 + 12) % 12) && ((currentMidi % 12 + 12) % 12) !== effectiveMelodyPC) {
          voicingMidi.push(currentMidi);
          effectiveMelodyPC = (currentMidi % 12 + 12) % 12;
          break;
        }
      }
    }
    return { voicingMidi, subMessage };
  }

  function midiToNoteName(midi, preferFlats) {
    const oct = Math.floor(midi / 12) - 1;
    const pc = (midi % 12 + 12) % 12;
    return (preferFlats ? pcToNoteFlat : pcToNoteSharp)[pc] + oct;
  }

  function midiToVex(midi, preferFlats) {
    const oct = Math.floor(midi / 12) - 1;
    const pc = (midi % 12 + 12) % 12;
    let noteStr = (preferFlats ? pcToNoteFlat : pcToNoteSharp)[pc];
    let acc = '';
    if (noteStr.includes('#')) { acc = '#'; noteStr = noteStr.replace('#',''); }
    if (noteStr.includes('b')) { acc = 'b'; noteStr = noteStr.replace('b',''); }
    return { key: `${noteStr}/${oct}`, acc };
  }

  function drawVexFlow(targetMidi, approachMidi, useApproach, preferFlats) {
    const VF = Vex.Flow;
    const container = document.getElementById('vexflow-canvas');
    container.innerHTML = '';
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(400, 250);
    const context = renderer.getContext();
    const treble = new VF.Stave(10, 20, 300).addClef('treble');
    const bass = new VF.Stave(10, 120, 300).addClef('bass');
    treble.setContext(context).draw();
    bass.setContext(context).draw();
    new VF.StaveConnector(treble, bass).setType(3).setContext(context).draw();
    new VF.StaveConnector(treble, bass).setType(0).setContext(context).draw();

    function buildStaveNote(midiArray, clef) {
      const selected = midiArray.filter((m) => clef === 'treble' ? m >= 60 : m < 60);
      if (!selected.length) return new VF.StaveNote({ clef, keys:[clef === 'treble' ? 'B/4' : 'D/3'], duration:'qr' });
      const keys = [];
      const accs = [];
      selected.forEach((m) => {
        const v = midiToVex(m, preferFlats);
        keys.push(v.key);
        if (v.acc) accs.push({index:keys.length - 1, type:v.acc});
      });
      const note = new VF.StaveNote({ clef, keys, duration:'q' });
      accs.forEach((a) => note.addAccidental(a.index, new VF.Accidental(a.type)));
      return note;
    }

    const trebleNotes = [];
    const bassNotes = [];
    if (useApproach) {
      trebleNotes.push(buildStaveNote(approachMidi, 'treble'));
      bassNotes.push(buildStaveNote(approachMidi, 'bass'));
    }
    trebleNotes.push(buildStaveNote(targetMidi, 'treble'));
    bassNotes.push(buildStaveNote(targetMidi, 'bass'));
    const beats = useApproach ? 2 : 1;
    const tv = new VF.Voice({num_beats:beats, beat_value:4}).addTickables(trebleNotes);
    const bv = new VF.Voice({num_beats:beats, beat_value:4}).addTickables(bassNotes);
    new VF.Formatter().joinVoices([tv]).joinVoices([bv]).format([tv,bv], 200);
    tv.draw(context, treble);
    bv.draw(context, bass);
  }

  function writeVarLength(value) {
    const buffer = [value & 0x7F];
    while ((value >>= 7)) buffer.push((value & 0x7F) | 0x80);
    return buffer.reverse();
  }

  function generateMidiFile(targetMidi, approachMidi, useApproach) {
    const events = [0x00,0xC0,0x00];
    if (useApproach && approachMidi.length) {
      approachMidi.forEach((note) => events.push(0x00,0x90,note,0x64));
      approachMidi.forEach((note,i) => events.push(...(i === 0 ? writeVarLength(120) : [0x00]),0x80,note,0x00));
      targetMidi.forEach((note) => events.push(0x00,0x90,note,0x64));
      targetMidi.forEach((note,i) => events.push(...(i === 0 ? writeVarLength(240) : [0x00]),0x80,note,0x00));
    } else {
      targetMidi.forEach((note) => events.push(0x00,0x90,note,0x64));
      targetMidi.forEach((note,i) => events.push(...(i === 0 ? writeVarLength(480) : [0x00]),0x80,note,0x00));
    }
    events.push(0x00,0xFF,0x2F,0x00);
    const header = [0x4d,0x54,0x68,0x64,0x00,0x00,0x00,0x06,0x00,0x00,0x00,0x01,0x00,0x78];
    const len = events.length;
    const trackHeader = [0x4d,0x54,0x72,0x6b,(len>>24)&255,(len>>16)&255,(len>>8)&255,len&255];
    const bytes = new Uint8Array([...header,...trackHeader,...events]);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return `data:audio/midi;base64,${btoa(binary)}`;
  }

  function updateMidiDownload() {
    const dl = document.getElementById('btn-download-midi');
    const dataUri = generateMidiFile(currentVoicingMidi, currentApproachMidi, isApproaching);
    dl.href = dataUri;
    dl.download = 'Harmonizer_Voicing.mid';
    dl.classList.remove('disabled-btn');
    dl.ondragstart = (e) => e.dataTransfer.setData('DownloadURL', `audio/midi:Harmonizer_Voicing.mid:${dataUri}`);
  }

  async function generateVoicing() {
    const tech = document.getElementById('harm-technique').value;
    const cRoot = document.getElementById('harm-chord-root').value;
    const cAcc = document.getElementById('harm-chord-accidental').value;
    const cType = document.getElementById('harm-chord-type').value;
    const mNote = document.getElementById('harm-mel-note').value;
    const mAcc = document.getElementById('harm-mel-accidental').value;
    const mOct = document.getElementById('harm-mel-octave').value;
    isApproaching = document.getElementById('harm-approach-toggle').checked;

    const preferFlats = cAcc === 'b' || ['F','Bb','Eb','Ab','Db','Gb','Cb'].includes(cRoot + cAcc);
    let rootPC = noteToPC[cRoot] + (cAcc === '#' ? 1 : cAcc === 'b' ? -1 : 0);
    rootPC = (rootPC + 12) % 12;
    const melMidi = getMidi(mNote, mAcc, mOct);
    const result = calculate4WayClose(melMidi, rootPC, cType, preferFlats);
    const voicingMidi = result.voicingMidi.sort((a,b) => b-a);
    if (tech === 'drop2' && voicingMidi.length >= 2) voicingMidi[1] -= 12;
    else if (tech === 'drop3' && voicingMidi.length >= 3) voicingMidi[2] -= 12;
    else if (tech === 'drop24' && voicingMidi.length >= 4) { voicingMidi[1] -= 12; voicingMidi[3] -= 12; }
    voicingMidi.sort((a,b) => a-b);
    currentVoicingMidi = [...voicingMidi];

    currentApproachMidi = [];
    if (isApproaching) {
      const appMidi = getMidi(document.getElementById('harm-app-note').value, document.getElementById('harm-app-accidental').value, document.getElementById('harm-app-octave').value);
      const interval = appMidi - melMidi;
      currentApproachMidi = voicingMidi.map((note) => note + interval);
    }

    document.getElementById('btn-play-voicing').disabled = false;
    let readout = `Target Voicing (Bottom to Top):<br>&gt; ${voicingMidi.map((m) => midiToNoteName(m, preferFlats)).join(' - ')}`;
    if (result.subMessage) readout += `<br><br><span style="color:var(--accent)">* ${result.subMessage}</span>`;
    if (isApproaching) readout = `Approach Voicing (Parallel):<br>&gt; ${currentApproachMidi.map((m) => midiToNoteName(m, preferFlats)).join(' - ')}<br><br>${readout}`;
    document.getElementById('harm-text-readout').innerHTML = readout;
    updateMidiDownload();

    const canvas = document.getElementById('vexflow-canvas');
    canvas.textContent = 'Loading notation…';
    try {
      await ensureVex();
      drawVexFlow(voicingMidi, currentApproachMidi, isApproaching, preferFlats);
    } catch (err) {
      canvas.textContent = 'Notation library could not load. MIDI and text output are still available.';
      console.error(err);
    }
  }

  document.getElementById('harm-approach-toggle').addEventListener('change', (e) => {
    document.getElementById('approach-inputs').classList.toggle('disabled-panel', !e.target.checked);
    document.getElementById('target-mel-title').textContent = e.target.checked ? 'Target Melody Note' : 'Melody Note';
  });
  document.getElementById('btn-generate-voicing').addEventListener('click', generateVoicing);
  document.getElementById('btn-play-voicing').addEventListener('click', async () => {
    if (!currentVoicingMidi.length) return;
    try {
      await ensureAudio();
      const now = Tone.now();
      if (isApproaching && currentApproachMidi.length) {
        pianoSampler.triggerAttackRelease(currentApproachMidi.map((m) => Tone.Frequency(m,'midi').toNote()), '4n', now);
        pianoSampler.triggerAttackRelease(currentVoicingMidi.map((m) => Tone.Frequency(m,'midi').toNote()), '2n', now + Tone.Time('4n').toSeconds());
      } else {
        pianoSampler.triggerAttackRelease(currentVoicingMidi.map((m) => Tone.Frequency(m,'midi').toNote()), 2.0, now);
      }
    } catch (err) {
      console.error(err);
    }
  });
})();
