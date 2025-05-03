const { ipcRenderer } = require('electron');

let blurOverlay = document.getElementById('blurOverlay');
if (!blurOverlay) {
  blurOverlay = document.createElement('div');
  blurOverlay.id = 'blurOverlay';
  blurOverlay.style.position = 'absolute';
  blurOverlay.style.top = '0';
  blurOverlay.style.left = '0';
  blurOverlay.style.width = '100%';
  blurOverlay.style.height = '100%';
  blurOverlay.style.backdropFilter = 'blur(4px)';
  blurOverlay.style.background = 'rgba(30,30,30,0.25)';
  blurOverlay.style.zIndex = '100';
  blurOverlay.style.pointerEvents = 'none';
  blurOverlay.style.transition = 'opacity 0.3s';
  blurOverlay.style.opacity = '0';
  document.body.appendChild(blurOverlay);
}

async function updateTrack() {
  const data = await ipcRenderer.invoke('get-current-track');
  if (!data || !data.item) {
    document.getElementById('cover').src = 'https://placehold.co/350x350?text=Spotify';
    infoDiv.textContent = 'No track playing';
    blurOverlay.style.opacity = '0';
    return;
  }
  document.getElementById('cover').src = data.item.album.images[0]?.url || '';
  const titleSize = window.settings?.titleFontSize || 1.1;
  const artistSize = window.settings?.artistFontSize || 0.95;
  infoDiv.innerHTML = `<span id="mainTitle" style="font-size:${titleSize}em;font-weight:bold;">${data.item.name}</span><br><span id="mainArtist" style="font-size:${artistSize}em;font-weight:normal;">${data.item.artists.map(a => a.name).join(', ')}</span>`;
  blurOverlay.style.opacity = data.is_playing ? '0' : '1';
}

setInterval(updateTrack, 3000);
updateTrack();

document.getElementById('closeBtn').onclick = () => {
  window.close();
};

document.getElementById('settingsBtn').onclick = () => {
  ipcRenderer.send('open-settings');
};

document.getElementById('lyricsBtn').onclick = () => {
  ipcRenderer.send('open-lyrics');
};

const cover = document.getElementById('cover');
let lyricsAutoOpened = false;
window.require('electron').ipcRenderer.on('settings-update', (event, settings) => {
  window.settings = settings;
  if (settings.radius !== undefined) cover.style.borderRadius = settings.radius + 'px';
  applySettingsFromConfig(settings);
  const infoDiv = document.getElementById('trackInfo');
  if (infoDiv && settings.titleFontSize) {
    const [title, ...artistParts] = infoDiv.textContent.split(' – ');
    if (title && artistParts.length) {
      infoDiv.innerHTML = `<span id="mainTitle" style="font-size:${settings.titleFontSize}em;font-weight:bold;">${title}</span><br><span id="mainArtist" style="font-size:${settings.artistFontSize || 0.95}em;font-weight:normal;">${artistParts.join(' – ')}</span>`;
    }
  }
  const mainTitle = document.getElementById('mainTitle');
  const mainArtist = document.getElementById('mainArtist');
  if (mainTitle && settings.titleFontSize !== undefined) {
    mainTitle.style.fontSize = settings.titleFontSize + 'em';
  }
  if (mainArtist && settings.artistFontSize !== undefined) {
    mainArtist.style.fontSize = settings.artistFontSize + 'em';
  }
  if (settings.showLyricsOnOpen && !lyricsAutoOpened) {
    ipcRenderer.send('ensure-lyrics-open');
    lyricsAutoOpened = true;
  }
});

window.addEventListener('resize', () => {
  const main = document.getElementById('main');
  main.style.width = window.innerWidth + 'px';
  main.style.height = window.innerHeight + 'px';
  cover.style.width = '100%';
  cover.style.height = '100%';
});

let resizeTimeout = null;
function enforceSquareWindow() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const min = Math.min(w, h);
    if (w !== h) {
      window.resizeTo(min, min);
    }
  }, 120);
}
window.addEventListener('resize', enforceSquareWindow);
window.addEventListener('DOMContentLoaded', enforceSquareWindow);

window.require('electron').ipcRenderer.on('settings-update', (event, settings) => {
  if (settings.radius !== undefined) cover.style.borderRadius = settings.radius + 'px';
  applySettingsFromConfig(settings);
  const infoDiv = document.getElementById('trackInfo');
  if (infoDiv && settings.titleFontSize) {
    const [title, ...artistParts] = infoDiv.textContent.split(' – ');
    if (title && artistParts.length) {
      infoDiv.innerHTML = `<span id="mainTitle" style="font-size:${settings.titleFontSize}em;font-weight:bold;">${title}</span><br><span id="mainArtist" style="font-size:${settings.artistFontSize || 0.95}em;font-weight:normal;">${artistParts.join(' – ')}</span>`;
    }
  }
});

const main = document.getElementById('main');
let infoDiv = document.getElementById('trackInfo');
if (!infoDiv) {
  infoDiv = document.createElement('div');
  infoDiv.id = 'trackInfo';
  infoDiv.style.position = 'absolute';
  infoDiv.style.left = '0';
  infoDiv.style.right = '0';
  infoDiv.style.bottom = '24px';
  infoDiv.style.textAlign = 'center';
  infoDiv.style.color = '#fff';
  infoDiv.style.textShadow = '0 2px 8px #000';
  infoDiv.style.fontSize = '1.1em';
  infoDiv.style.pointerEvents = 'none';
  main.appendChild(infoDiv);
}

function applySettingsFromConfig(settings) {
  if (settings.font) {
    document.body.style.fontFamily = settings.font;
  }
  if (settings.blur !== undefined) {
    let blurOverlay = document.getElementById('blurOverlay');
    if (blurOverlay) {
      blurOverlay.style.backdropFilter = `blur(${settings.blur || 0}px)`;
    }
  }
}

ipcRenderer.invoke('get-current-track').then(() => {
  ipcRenderer.on('settings-update', (event, settings) => {
    if (settings.radius !== undefined) cover.style.borderRadius = settings.radius + 'px';
    applySettingsFromConfig(settings);
  });
});