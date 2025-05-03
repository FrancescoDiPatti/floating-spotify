const { ipcRenderer } = require('electron');

function update(data, settings) {
  const titleDiv = document.getElementById('title');
  const artistDiv = document.getElementById('artist');
  titleDiv.textContent = data?.item?.name || '';
  artistDiv.textContent = data?.item?.artists?.map(a => a.name).join(', ') || '';
  if (settings) {
    if (settings.titleFontSize !== undefined) {
      titleDiv.style.fontSize = settings.titleFontSize + 'em';
    }
    if (settings.artistFontSize !== undefined) {
      artistDiv.style.fontSize = settings.artistFontSize + 'em';
    }
    titleDiv.style.fontWeight = 'bold';
    artistDiv.style.fontWeight = 'normal';
  }
}

ipcRenderer.on('track-update', (_, data) => {
  update(data, window.currentSettings);
});

ipcRenderer.on('settings-update', (event, settings) => {
  window.currentSettings = settings;
  if (settings.font) {
    document.body.style.fontFamily = settings.font;
  }
  if (settings.blur !== undefined) {
    document.body.style.backdropFilter = `blur(${settings.blur}px)`;
    document.body.style.webkitBackdropFilter = `blur(${settings.blur}px)`;
  }
  if (settings.opacity !== undefined) {
    document.body.style.opacity = settings.opacity;
  }
  if (settings.radius !== undefined) {
    document.body.style.borderRadius = settings.radius + 'px';
  }
  const titleDiv = document.getElementById('title');
  const artistDiv = document.getElementById('artist');
  if (settings.titleFontSize !== undefined && titleDiv) {
    titleDiv.style.fontSize = settings.titleFontSize + 'em';
  }
  if (settings.artistFontSize !== undefined && artistDiv) {
    artistDiv.style.fontSize = settings.artistFontSize + 'em';
  }
  if (titleDiv) titleDiv.style.fontWeight = 'bold';
  if (artistDiv) artistDiv.style.fontWeight = 'normal';
});

ipcRenderer.invoke('get-current-track').then(data => update(data, window.currentSettings));
