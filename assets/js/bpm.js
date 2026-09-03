(() => {
  const tapTimes = [];
  const bpmDisplay = document.getElementById('bpm-value');
  const countDisplay = document.getElementById('tap-count');
  const avgDisplay = document.getElementById('tap-avg');

  function recordTap() {
    const now = performance.now();
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes.length = 0;
    tapTimes.push(now);
    countDisplay.textContent = tapTimes.length;
    if (tapTimes.length === 1) {
      bpmDisplay.textContent = '---';
      avgDisplay.textContent = '0.00';
      return;
    }
    let totalDiff = 0;
    for (let i = 1; i < tapTimes.length; i++) totalDiff += tapTimes[i] - tapTimes[i - 1];
    const exactBpm = 60000 / (totalDiff / (tapTimes.length - 1));
    bpmDisplay.textContent = Math.round(exactBpm);
    avgDisplay.textContent = exactBpm.toFixed(2);
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
      e.preventDefault();
      recordTap();
    }
  });
  document.getElementById('bpm-tap-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); recordTap(); });
})();
