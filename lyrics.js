const { ipcRenderer, remote } = require('electron');

let lyricsLines = [];
let currentLineIdx = -1;
let timer = null;
let lastTrack = { title: '', artist: '', duration: 0 };
let lastLyricsRaw = '';
let syncEnabled = true;
let manualMoveDetected = false;

let lyricsSettings = {
  lyricsColor: '#ffffff',
  lyricsColorMode: 'fixed',
  lyricsColorSpeed: 4,
  lyricsBlur: 2,
  lyricsFont: 'sans-serif'
};
let colorInterval = null;
let currentLyricsColor = '#ffffff';

let userScrolling = false;
let userScrollTimeout = null;

function parseLRC(lrc) {
  const lines = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/g;
  for (const rawLine of lrc.split(/\r?\n/)) {
    let match = regex.exec(rawLine);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
      const time = min * 60 + sec + ms / 1000;
      lines.push({ time, text: match[4].trim() });
    }
    regex.lastIndex = 0;
  }
  return lines.sort((a, b) => a.time - b.time);
}

function highlightLyrics(currentSec) {
  if (!lyricsLines.length || !syncEnabled) return;
  let idx = lyricsLines.findIndex((l, i) => l.time > currentSec) - 1;
  if (idx < 0) idx = 0;
  if (idx !== currentLineIdx) {
    currentLineIdx = idx;
    const lyricsDiv = document.getElementById('lyrics');
    lyricsDiv.innerHTML = lyricsLines.map((l, i) =>
      `<div>${l.text || '&nbsp;'}</div>`
    ).join('');
    updateLyricsColors();
    if (!userScrolling) {
      const current = lyricsDiv.children[idx];
      if (current) {
        current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }
}

async function updateLyrics() {
  const data = await ipcRenderer.invoke('get-current-track');
  if (!data || !data.item) {
    document.getElementById('lyrics').textContent = 'No track playing.';
    lyricsLines = [];
    lastTrack = { title: '', artist: '', duration: 0 };
    lastLyricsRaw = '';
    return;
  }
  const title = data.item.name;
  const artist = data.item.artists.map(a => a.name).join(', ');
  const duration = data.item.duration_ms ? Math.round(data.item.duration_ms / 1000) : 0;

  if (
    lastTrack.title === title &&
    lastTrack.artist === artist &&
    lastTrack.duration === duration
  ) {
    return;
  }

  lastTrack = { title, artist, duration };
  document.getElementById('lyrics').textContent = 'Loading...';
  const lrc = await ipcRenderer.invoke('fetch-lyrics', { artist, title, duration });
  lastLyricsRaw = lrc || '';
  if (!lrc) {
    document.getElementById('lyrics').textContent = 'Lyrics not found.';
    lyricsLines = [];
    return;
  }
  lyricsLines = parseLRC(lrc);
  if (!lyricsLines.length) {
    document.getElementById('lyrics').textContent = lrc;
    return;
  }
  highlightLyrics(0);
}

async function syncLoop() {
  if (!syncEnabled) return;
  const data = await ipcRenderer.invoke('get-current-track');
  if (!data || !data.is_playing || !data.progress_ms) return;
  const currentSec = data.progress_ms / 1000;
  highlightLyrics(currentSec);
}

document.getElementById('syncBtn').onclick = () => {
  syncEnabled = true;
  document.getElementById('syncBtn').style.display = 'none';
  currentLineIdx = -1;
  syncLoop();
};

ipcRenderer.on('settings-update', (event, settings) => {
  applyLyricsSettings(settings);
  document.body.style.opacity = settings.opacity;
  document.body.style.borderRadius = (settings.radius || 24) + 'px';
  if (settings.lyricsFontSize !== undefined) {
    document.getElementById('lyrics').style.fontSize = settings.lyricsFontSize + 'em';
  }
  if (settings.lyricsLineHeight !== undefined) {
    document.getElementById('lyrics').style.lineHeight = settings.lyricsLineHeight;
  }
});

function applyLyricsSettings(settings) {
  if (settings.lyricsFont) {
    document.getElementById('lyrics').style.fontFamily = settings.lyricsFont;
    lyricsSettings.lyricsFont = settings.lyricsFont;
  }
  if (settings.lyricsBlur !== undefined) {
    lyricsSettings.lyricsBlur = settings.lyricsBlur;
  }
  if (settings.lyricsColor) {
    lyricsSettings.lyricsColor = settings.lyricsColor;
  }
  if (settings.lyricsColorMode) {
    lyricsSettings.lyricsColorMode = settings.lyricsColorMode;
  }
  if (settings.lyricsColorSpeed) {
    lyricsSettings.lyricsColorSpeed = settings.lyricsColorSpeed;
  }
  setupLyricsColorMode();
}

function setupLyricsColorMode() {
  if (colorInterval) clearInterval(colorInterval);
  if (lyricsSettings.lyricsColorMode === 'fixed') {
    currentLyricsColor = lyricsSettings.lyricsColor;
    updateLyricsColors();
  } else if (lyricsSettings.lyricsColorMode === 'random') {
    colorInterval = setInterval(() => {
      currentLyricsColor = generateRandomLightColor(0.97);
      updateLyricsColors();
    }, lyricsSettings.lyricsColorSpeed * 1000);
    currentLyricsColor = generateRandomLightColor(0.97);
    updateLyricsColors();
  } else if (lyricsSettings.lyricsColorMode === 'sequence') {
    let hue = 0;
    colorInterval = setInterval(() => {
      hue = (hue + 30) % 360;
      currentLyricsColor = `hsl(${hue}, 69%, 69%, 0.97)`;
      updateLyricsColors();
    }, lyricsSettings.lyricsColorSpeed * 1000);
    currentLyricsColor = `hsl(0, 69%, 69%, 0.97)`;
    updateLyricsColors();
  } else if (lyricsSettings.lyricsColorMode === 'spotify') {
    const spotifyColors = [
      '#1DB954', '#191414', '#535353', '#1ed760', '#1db954', '#191414', '#535353', '#1ed760'
    ];
    let idx = 0;
    colorInterval = setInterval(() => {
      currentLyricsColor = spotifyColors[idx % spotifyColors.length];
      idx++;
      updateLyricsColors();
    }, lyricsSettings.lyricsColorSpeed * 1000);
    currentLyricsColor = spotifyColors[0];
    updateLyricsColors();
  } else if (lyricsSettings.lyricsColorMode === 'smooth-random') {
    let hue = Math.floor(Math.random() * 360);
    let direction = 1;
    function nextSmoothColor() {
      hue += direction * 1;
      if (hue > 359) hue = 0;
      if (hue < 0) hue = 359;
      currentLyricsColor = generateRandomLightColorFromHue(hue, 0.97);
      updateLyricsColors();
    }
    let interval = 10 + (lyricsSettings.lyricsColorSpeed * 40);
    colorInterval = setInterval(nextSmoothColor, interval);
    nextSmoothColor();
  }
}

function generateRandomLightColor(opacity) {
  const h = Math.floor(Math.random() * 360);
  const s = 69;
  const l = 69;
  return `hsl(${h}, ${s}%, ${l}%, ${opacity})`;
}

function generateRandomLightColorFromHue(h, opacity) {
  const s = 69;
  const l = 69;
  return `hsl(${h}, ${s}%, ${l}%, ${opacity})`;
}

function updateLyricsColors() {
  document.body.style.background = currentLyricsColor;
  const lyricsDiv = document.getElementById('lyrics');
  Array.from(lyricsDiv.children).forEach((el, i) => {
    if (i < currentLineIdx) {
      el.style.color = '#fff';
      el.style.filter = `blur(${lyricsSettings.lyricsBlur}px)`;
      el.style.background = 'none';
    } else if (i === currentLineIdx) {
      el.style.color = '#fff';
      el.style.fontWeight = 'bold';
      el.style.fontSize = (lyricsSettings.lyricsFontSize || 1.1) + 'em';
      el.style.filter = 'none';
      el.style.background = 'none';
    } else {
      el.style.color = '#000';
      el.style.filter = `blur(${lyricsSettings.lyricsBlur}px)`;
      el.style.background = 'none';
    }
  });
}

const lyricsDiv = document.getElementById('lyrics');
lyricsDiv.addEventListener('wheel', (e) => {
  lyricsDiv.scrollTop += e.deltaY;
  userScrolling = true;
  if (userScrollTimeout) clearTimeout(userScrollTimeout);
  userScrollTimeout = setTimeout(() => { userScrolling = false; }, 2000);
});

let lastPos = null;
setInterval(() => {
  const [x, y] = remote.getCurrentWindow().getPosition();
  if (lastPos && (x !== lastPos[0] || y !== lastPos[1])) {
    if (syncEnabled) {
      syncEnabled = false;
      document.getElementById('syncBtn').style.display = 'inline';
    }
  }
  lastPos = [x, y];
}, 500);

updateLyrics();
timer = setInterval(syncLoop, 700);
setInterval(updateLyrics, 10000);
