(() => {
  const keys = [
    {maj:'C',min:'Am',roots:['C','D','E','F','G','A','B']},{maj:'G',min:'Em',roots:['G','A','B','C','D','E','F#']},
    {maj:'D',min:'Bm',roots:['D','E','F#','G','A','B','C#']},{maj:'A',min:'F#m',roots:['A','B','C#','D','E','F#','G#']},
    {maj:'E',min:'C#m',roots:['E','F#','G#','A','B','C#','D#']},{maj:'B',min:'G#m',roots:['B','C#','D#','E','F#','G#','A#']},
    {maj:'Gb',min:'Ebm',roots:['Gb','Ab','Bb','Cb','Db','Eb','F']},{maj:'Db',min:'Bbm',roots:['Db','Eb','F','Gb','Ab','Bb','C']},
    {maj:'Ab',min:'Fm',roots:['Ab','Bb','C','Db','Eb','F','G']},{maj:'Eb',min:'Cm',roots:['Eb','F','G','Ab','Bb','C','D']},
    {maj:'Bb',min:'Gm',roots:['Bb','C','D','Eb','F','G','A']},{maj:'F',min:'Dm',roots:['F','G','A','Bb','C','D','E']}
  ];
  const circle = document.getElementById('circle-graphic');
  const suggestions = document.getElementById('suggestion-content');
  const startAngle = -Math.PI / 2;

  keys.forEach((item, index) => {
    const angle = startAngle + index * Math.PI * 2 / 12;
    [[item.maj, 40, 'major', 'Major'], [item.min, 22, 'minor', 'Minor']].forEach(([label, radius, cls, type]) => {
      const btn = document.createElement('button');
      btn.className = `circle-btn ${cls}`;
      btn.style.left = `${50 + Math.cos(angle) * radius}%`;
      btn.style.top = `${50 + Math.sin(angle) * radius}%`;
      btn.textContent = label;
      btn.setAttribute('aria-label', `${label} ${type} key`);
      btn.addEventListener('click', () => {
        document.querySelectorAll('.circle-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderSuggestions(item, type);
      });
      circle.appendChild(btn);
    });
  });

  function renderSuggestions(data, scaleType) {
    const major = scaleType === 'Major';
    const keyName = major ? data.maj : data.min;
    const relative = major ? data.min : data.maj;
    const r = data.roots;
    const majTriads = [r[0],r[1]+'m',r[2]+'m',r[3],r[4],r[5]+'m',r[6]+'dim'];
    const minTriads = [r[5]+'m',r[6]+'dim',r[0],r[1]+'m',r[2]+'m',r[3],r[4]];
    const maj7 = [r[0]+'maj7',r[1]+'m7',r[2]+'m7',r[3]+'maj7',r[4]+'7',r[5]+'m7',r[6]+'m7b5'];
    const min7 = [r[5]+'m7',r[6]+'m7b5',r[0]+'maj7',r[1]+'m7',r[2]+'m7',r[3]+'maj7',r[4]+'7'];
    const triads = major ? majTriads : minTriads;
    const sevenths = major ? maj7 : min7;
    let blocks;
    if (major) {
      blocks = [
        ['I - IV - V', `${triads[0]} - ${triads[3]} - ${triads[4]}`],
        ['I - vi - IV - V', `${triads[0]} - ${triads[5]} - ${triads[3]} - ${triads[4]}`],
        ['ii7 - V7 - Imaj7', `${sevenths[1]} - ${sevenths[4]} - ${sevenths[0]}`]
      ];
    } else {
      const V7 = r[2] + '7';
      blocks = [
        ['i - iv - v', `${triads[0]} - ${triads[3]} - ${triads[4]}`],
        ['i - VI - III - VII', `${triads[0]} - ${triads[5]} - ${triads[2]} - ${triads[6]}`],
        ['iim7b5 - V7 - im7', `${sevenths[1]} - ${V7} - ${sevenths[0]}`]
      ];
    }
    suggestions.innerHTML = `<h3>${keyName} ${scaleType}</h3>
      <div class="suggestion-box"><h4>Relative ${major ? 'Minor' : 'Major'}</h4><p>${relative}</p></div>
      <div class="suggestion-box"><h4>Common progressions</h4>${blocks.map(([title, progression]) => `<p><strong>${title}:</strong> ${progression}</p>`).join('')}</div>`;
  }
})();
