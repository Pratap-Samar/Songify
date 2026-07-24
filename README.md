# Songify

A Spotify-inspired, Android-first music application.

## Development Setup

The mobile app is written in TypeScript and calls a Python FastAPI backend that uses `ytmusicapi` for search and playback metadata.

1. Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_BASE_URL` to the Songify backend URL. Use your computer's LAN IP for physical-device testing. For web testing, use `http://localhost:8000`.
   ```powershell
   copy .env.example .env.local
   ```
   Then edit `.env.local` and set:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
   ```
2. Create and activate a Python virtual environment in `backend`.
3. Install backend dependencies with `python -m pip install -r requirements.txt`.
4. Start the backend with `python -m uvicorn app.main:app --reload --port 8000` from `backend`.
5. Start the Expo app with `npm start` from the project root.
6. Press `w` in the Expo Dev Tools terminal to open the app in a web browser.

### Web Testing (live reload dev mode)

In one terminal, start the backend:

```powershell
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

In another terminal, start the web dev server:

```powershell
npm run web
```

Open the URL printed in the terminal (default `http://localhost:8082`).

The Expo development server handles `SharedArrayBuffer` and SQLite headers automatically. The web build is intended for UI-only testing since audio playback requires a native module.

### Audio Playback Limitation

The search endpoint returns full metadata for all YouTube Music tracks. However, most YouTube Music stream URLs are encrypted (`signatureCipher`) and `ytmusicapi` cannot resolve direct audio URLs for them. This means playback will only work for tracks where the unofficial API happens to expose a decrypted URL — which is not guaranteed.

- **Android development build** (`npm run android` then press `s`): Playback attempts to use a resolved stream URL. If the track has no URL, an error is shown.
- **Web**: Audio controls are no-ops.

If reliable audio streaming is a priority, consider using the official YouTube Music API or a licensed streaming provider instead of `ytmusicapi`.

### Static Production Build

```powershell
npx expo export --platform web
```

Then serve the `dist/` directory with a server that sends these HTTP headers:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without those headers the browser blocks `SharedArrayBuffer` and the app will not load. A quick Python one-liner does **not** set those headers.

See [plan.md](./plan.md) for the planned architecture and delivery milestones.
