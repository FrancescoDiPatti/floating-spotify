const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const TOKEN_PATH = path.join(__dirname, 'spotify_token.json');

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'user-read-currently-playing user-read-playback-state',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function getTokenFromCode(code) {
  const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const tokenData = { ...response.data, timestamp: Date.now() };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData));
  return tokenData;
}

function getSavedToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(TOKEN_PATH));
  }
  return null;
}

async function refreshToken(refresh_token) {
  const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const token = { ...getSavedToken(), ...response.data, timestamp: Date.now() };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  return token;
}

async function getAccessToken() {
  let token = getSavedToken();
  if (!token) return null;
  if (token.timestamp === undefined || Date.now() > (token.timestamp + (token.expires_in * 1000) - 60000)) {
    token = await refreshToken(token.refresh_token);
  }
  return token.access_token;
}

async function getCurrentTrack() {
  const access_token = await getAccessToken();
  if (!access_token) return null;
  const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (response.status === 204) return null;
  return response.data;
}

module.exports = {
  getAuthUrl,
  getTokenFromCode,
  getCurrentTrack,
  getSavedToken,
};
