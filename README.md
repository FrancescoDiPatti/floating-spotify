# Floating Spotify

Floating Spotify is a small desktop application (Electron) that displays the cover, title, artist, and synchronized lyrics of the currently playing song on Spotify. The interface is minimal, always on top, and customizable through a settings panel.

# No longer maintained
Now the application main function (Lyrics) is part of a pull request of [lofi](https://github.com/dvx/lofi), so I will not change this program for now (https://github.com/dvx/lofi/pull/327)

## Main Features
- Display of cover, title, and artist of the currently playing track
- Synchronized lyrics window (LRC) with current line highlighting
- Customizable lyrics color modes (fixed, random, sequence, smooth, Spotify)
- Customization of font, opacity, blur, borders, text size, etc.
- Synchronization of lyrics window position relative to the main window

## Requirements
- Node.js
- A Spotify
- Register an app on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications) to obtain CLIENT_ID and CLIENT_SECRET

## Installation
1. Clone the repository:
   ```sh
   git clone <https://github.com/FrancescoDiPatti/floating-spotify>
   cd floating_spotify
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file in the project root with the following variables:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```
4. Start the application:
   ```sh
   npm start
   ```

On first launch, you will be asked to authenticate the application with Spotify.

## Notes
- Access tokens are saved locally in `spotify_token.json`.
- Settings are saved in `settings.json`.
- The application automatically retrieve lyrics from lrclib.net and communicate with the Spotify APIs.
