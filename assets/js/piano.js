(() => {
  let pianoSampler = null;
  let reverb = null;
  let reverbEnabled = false;
  let audioPromise = null;
  let currentOctave = 3;
  let triadMode = 'single';
  let seventhMode = 'none';
  const allPlayingMidiNotes = new Map();

  const keyMap = {
    a:{note:0,type:'white'}, w:{note:1,type:'black'}, s:{note:2,type:'white'}, e:{note:3,type:'black'},
    d:{note:4,type:'white'}, f:{note:5,type:'white'}, t:{note:6,type:'black'}, g:{note:7,type:'white'},
    y:{note:8,type:'black'}, h:{note:9,type:'white'}, u:{note:10,type:'black'}, j:{note:11,type:'white'},
    k:{note:12,type:'white'}, o:{note:13,type:'black'}, l:{note:14,type:'white'}, p:{note:15,type:'black'},
    ';':{note:16,type:'white'}, "'":{note:17,type:'white'}
  };
  const chordDict = {
    '0,4,7':'Maj','0,3,7':'Min','0,3,6':'Dim','0,4,8':'Aug','0,2,7':'sus2','0,5,7':'sus4','0,4,6':'Maj(b5)',
    '0,4,7,11':'Maj7','0,4,7,10':'7','0,3,7,10':'m7','0,3,7,11':'mM7','0,3,6,10':'m7b5','0,3,6,9':'dim7',
    '0,4,8,10':'7#5','0,4,8,11':'Maj7#5','0,4,7,9':'6','0,3,7,9':'m6','0,5,7,10':'7sus4','0,2,4,7':'add9','0,2,3,7':'m(add9)',
    '0,2,4,7,11':'Maj9','0,2,4,7,10':'9','0,2,3,7,10':'m9','0,1,4,7,10':'7b9','0,3,4,7,10':'7#9','0,2,3,6,10':'m9b5',
    '0,2,4,7,9':'6/9','0,2,3,7,9':'m6/9','0,2,4,5,7,10':'11','0,2,3,5,7,10':'m11','0,2,4,6,7,11':'Maj7#11',
    '0,2,4,7,9,10':'13','0,2,4,7,9,11':'Maj13','0,2,3,7,9,10':'m13'
  };
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Tone) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function setAudioStatus(text, ready) {
    const el = document.getElementById('audio-status');
    const textEl = document.getElementById('audio-status-text');
    if (textEl) textEl.textContent = text;
    if (el) el.classList.toggle('ready', !!ready);
  }

  async function ensureAudio() {
    if (pianoSampler) {
      await Tone.start();
      return;
    }
    if (audioPromise) return audioPromise;
    audioPromise = (async () => {
      setAudioStatus('Loading piano engine and samples…', false);
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js');
      await Tone.start();
      pianoSampler = new Tone.Sampler({
        urls: {
          A0:'A0.mp3', C1:'C1.mp3', 'D#1':'Ds1.mp3', 'F#1':'Fs1.mp3', A1:'A1.mp3', C2:'C2.mp3', 'D#2':'Ds2.mp3',
          'F#2':'Fs2.mp3', A2:'A2.mp3', C3:'C3.mp3', 'D#3':'Ds3.mp3', 'F#3':'Fs3.mp3', A3:'A3.mp3', C4:'C4.mp3',
          'D#4':'Ds4.mp3', 'F#4':'Fs4.mp3', A4:'A4.mp3', C5:'C5.mp3', 'D#5':'Ds5.mp3', 'F#5':'Fs5.mp3', A5:'A5.mp3',
          C6:'C6.mp3', 'D#6':'Ds6.mp3', 'F#6':'Fs6.mp3', A6:'A6.mp3', C7:'C7.mp3', 'D#7':'Ds7.mp3', 'F#7':'Fs7.mp3',
          A7:'A7.mp3', C8:'C8.mp3'
        },
        release: 1,
        volume: -6,
        baseUrl: 'https://tonejs.github.io/audio/salamander/'
      });
      reverb = new Tone.Reverb({ decay: 4, wet: 0 }).toDestination();
      pianoSampler.connect(reverb);
      pianoSampler.toDestination();
      await Tone.loaded();
      updateReverbMix();
      initMidi();
      setAudioStatus('Audio ready. Keyboard and MIDI input are enabled.', true);
    })().catch((err) => {
      audioPromise = null;
      setAudioStatus('Audio could not load. Check the network and try again.', false);
      console.error(err);
      throw err;
    });
    return audioPromise;
  }

  const pianoContainer = document.getElementById('piano');
  Object.entries(keyMap).forEach(([key, data]) => {
    const div = document.createElement('div');
    div.className = `key ${data.type}`;
    div.dataset.key = key;
    div.innerHTML = key.toUpperCase();
    div.addEventListener('pointerdown', async () => {
      try { await ensureAudio(); triggerChord(key, (currentOctave + 1) * 12 + data.note, true); } catch (_) {}
    });
    ['pointerup','pointerleave','pointercancel'].forEach((eventName) => div.addEventListener(eventName, () => releaseChord(key)));
    pianoContainer.appendChild(div);
  });

  function toggleVirtualKey(baseMidi, isActive) {
    Object.entries(keyMap).forEach(([key, data]) => {
      if ((currentOctave + 1) * 12 + data.note === baseMidi) {
        const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (el) el.classList.toggle('active', isActive);
      }
    });
  }

  function triggerChord(identifier, baseMidi, isVirtual) {
    if (!pianoSampler || allPlayingMidiNotes.has(identifier)) return;
    if (isVirtual) toggleVirtualKey(baseMidi, true);
    const notes = [baseMidi];
    if (triadMode === 'major') notes.push(baseMidi + 4, baseMidi + 7);
    if (triadMode === 'minor') notes.push(baseMidi + 3, baseMidi + 7);
    if (triadMode === 'dim') notes.push(baseMidi + 3, baseMidi + 6);
    if (seventhMode === 'maj7') notes.push(baseMidi + 11);
    if (seventhMode === 'min7') notes.push(baseMidi + 10);
    allPlayingMidiNotes.set(identifier, { notes, isVirtual, baseMidi });
    pianoSampler.triggerAttack(notes.map((m) => Tone.Frequency(m, 'midi').toNote()));
    detectCurrentChord();
  }

  function releaseChord(identifier) {
    if (!pianoSampler || !allPlayingMidiNotes.has(identifier)) return;
    const chordData = allPlayingMidiNotes.get(identifier);
    if (chordData.isVirtual) toggleVirtualKey(chordData.baseMidi, false);
    pianoSampler.triggerRelease(chordData.notes.map((m) => Tone.Frequency(m, 'midi').toNote()));
    allPlayingMidiNotes.delete(identifier);
    detectCurrentChord();
  }

  function detectCurrentChord() {
    const display = document.getElementById('chord-display');
    const active = [];
    allPlayingMidiNotes.forEach((data) => active.push(...data.notes));
    if (active.length < 2) { display.textContent = '--'; return; }
    const pcs = [...new Set(active.map((n) => n % 12))].sort((a,b) => a-b);
    for (const root of pcs) {
      const key = pcs.map((n) => (n - root + 12) % 12).sort((a,b) => a-b).join(',');
      if (chordDict[key]) { display.textContent = `${noteNames[root]} ${chordDict[key]}`; return; }
    }
    display.textContent = 'Custom';
  }

  function initMidi() {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then((midiAccess) => {
      for (const input of midiAccess.inputs.values()) input.onmidimessage = getMIDIMessage;
    }).catch(() => {});
  }

  async function getMIDIMessage(message) {
    await ensureAudio();
    const [command, note, velocity = 0] = message.data;
    const id = `midi_${note}`;
    if (command === 144 && velocity > 0) triggerChord(id, note, false);
    else if (command === 128 || (command === 144 && velocity === 0)) releaseChord(id);
  }

  function updateReverbMix() {
    if (!reverb) return;
    const wet = parseFloat(document.getElementById('reverb-wet').value);
    reverb.wet.value = reverbEnabled ? wet : 0;
  }

  document.getElementById('enable-audio-btn').addEventListener('click', () => ensureAudio().catch(() => {}));
  document.getElementById('reverb-toggle').addEventListener('change', (e) => { reverbEnabled = e.target.checked; updateReverbMix(); });
  document.getElementById('reverb-wet').addEventListener('input', updateReverbMix);
  document.getElementById('oct-up').addEventListener('click', () => { if (currentOctave < 7) currentOctave++; document.getElementById('octave-display').textContent = currentOctave; });
  document.getElementById('oct-down').addEventListener('click', () => { if (currentOctave > 1) currentOctave--; document.getElementById('octave-display').textContent = currentOctave; });

  function setTriadMode(mode) {
    triadMode = triadMode === mode ? 'single' : mode;
    document.querySelectorAll('[data-group="triad"]').forEach((b) => b.classList.toggle('active', b.dataset.mode === triadMode));
  }
  function setSeventhMode(mode) {
    seventhMode = seventhMode === mode ? 'none' : mode;
    document.querySelectorAll('[data-group="seventh"]').forEach((b) => b.classList.toggle('active', b.dataset.mode === seventhMode));
  }
  document.querySelectorAll('.mode-btn').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.group === 'triad') setTriadMode(btn.dataset.mode);
    if (btn.dataset.group === 'seventh') setSeventhMode(btn.dataset.mode);
  }));

  document.addEventListener('keydown', async (e) => {
    if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (keyMap[k]) {
      try { await ensureAudio(); triggerChord(k, (currentOctave + 1) * 12 + keyMap[k].note, true); } catch (_) {}
    }
    if (k === '1') document.getElementById('oct-down').click();
    if (k === '2') document.getElementById('oct-up').click();
    if (k === 'z') setTriadMode('single');
    if (k === 'm') setTriadMode('major');
    if (k === 'n') setTriadMode('minor');
    if (k === ',') setTriadMode('dim');
    if (k === 'x') setSeventhMode('none');
    if (k === 'b') setSeventhMode('maj7');
    if (k === 'v') setSeventhMode('min7');
  });
  document.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keyMap[k]) releaseChord(k); });
})();
