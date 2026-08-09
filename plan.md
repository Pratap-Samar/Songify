# Songify Implementation Plan

## Product Goal

Build an Android-first, Spotify-inspired music application that searches YouTube Music metadata through `ytmusicapi`, plays audio (streaming via yt-dlp audio proxy with Range/partial-content support), and lets users create device-local playlists.

## Technology Stack

### Mobile Application

- React Native 0.81 with Expo SDK 54
- TypeScript with strict compiler settings
- Expo Router for application routes
- React Native Track Player for the audio queue, Android background playback, notification controls, and lock-screen controls. Web stub replaced with custom HTML5 Audio + `createObjectURL` (later reverted to direct `crossOrigin='anonymous'` src once backend Range proxy was stable).
- Expo SQLite (lazy-initialized, web-safe) for local playlists
- Expo development builds for Android device testing

### Backend

- Python 3
- FastAPI + Uvicorn
- ytmusicapi for YouTube Music search and metadata
- yt-dlp for stream URL resolution (falls back to combined format 18 when audio-only is blocked)
- httpx for upstream audio streaming with Range forwarding
- Pydantic models for request validation and stable API responses

### Quality and Tooling

- ESLint with Expo configuration
- TypeScript compiler validation
- Pytest for backend response-mapping and endpoint tests
- Git for source control

## Architecture

The React Native application calls a backend over HTTP(S). The backend calls `ytmusicapi` for metadata and `yt-dlp` for playable stream URLs; the mobile app must not directly depend on either.

**Audio proxy flow:**
1. Frontend requests `GET /tracks/{videoId}/playback` → gets metadata + proxy URL
2. Frontend sets `<audio src="http://backend:8000/proxy/audio/{videoId}" crossOrigin="anonymous" />`
3. Backend resolves a stream URL via yt-dlp (audio-only first, then combined format 18 if 403)
4. Backend opens an httpx streaming connection to YouTube's CDN, forwards `Range` headers, and streams the body through with correct `Content-Type` and CORS headers

**URL cache:** In-memory dict with 300s TTL stores resolved URL, upstream headers, content-type, and content-length per videoId so Range-seek requests don't re-trigger yt-dlp.

## Backend API

### `GET /health`
Returns availability check.

### `GET /search?q=<query>`
Validates query, calls `ytmusicapi.search(q, filter="songs")`, normalizes results.

### `GET /tracks/{videoId}/playback`
Returns track metadata with `streamUrl` pointing to the proxy endpoint.

### `GET /proxy/audio/{videoId}`
Full streaming proxy:
- Validates video ID via `re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)`
- Resolves stream URL via yt-dlp (audio-only; falls back to combined format 18 on 403)
- Opens upstream connection eagerly to capture content-type/content-length
- Returns `206 Partial Content` with `Content-Range` when client sends `Range` header
- Returns `200 OK` with full body when no Range
- CORS headers on every response
- Global exception handlers ensure `Access-Control-Allow-Origin` on error responses

## Current Status

### Completed

1. FastAPI backend with `/health`, `/search`, `/tracks/{videoId}/playback`, `/proxy/audio/{videoId}` (with Range support, 403 fallback, CORS)
2. Typed API client with configurable `EXPO_PUBLIC_API_BASE_URL`
3. Debounced search with loading/empty/error states
4. SQLite database for local playlists (lazy init, web-safe)
5. Playlist screens: list + create, detail + add/remove tracks
6. react-native-track-player integration (native) + custom HTML5 Audio on web (no shaka)
7. yt-dlp stream resolution with format-18 fallback for blocked audio-only videos
8. Web export working (wasm in metro.config, `crossOrigin="anonymous"` direct src, no blob URLs)
9. Backend pytest tests passing
10. Global exception handlers (`Exception`, `HTTPException`) attach CORS headers via `_cors_headers()` helper
11. CORS config unified — regex-based origin matching (local-network ranges + `DEV_ALLOWED_ORIGINS` env var) used by middleware, exception handlers, and proxy endpoint; `Vary: Origin` header set on all CORS responses
12. Audio proxy returns `206 Partial Content` with `Content-Range` for Range requests; upstream content-type/content-length captured eagerly before streaming
13. In-memory URL cache (300s TTL) avoids repeated yt-dlp resolution for seek-range requests to the same video
14. Non-audio content-type guard prevents proxying error pages (403 text/plain) as audio
15. **Player progress UI** — seek bar with drag-to-seek (release seeks, not continuous), elapsed (`m:ss`) and remaining (`-m:ss`) time labels; web uses `audio.ontimeupdate`, native uses `TrackPlayer` progress events via unified `addProgressListener` API
16. **Android media notification & lock-screen controls** — capabilities (`Play`, `Pause`, `Stop`, `SeekTo`, `Skip`, `SkipToNext`, `SkipToPrevious`) configured in `track-player.ts`; remote-event handlers (`RemotePlay/Pause/Next/Previous/Seek/Stop`) in `playback-service.ts`; track metadata (`title`, `artist`, `artwork`) passed via `mapTrack()`; `POST_NOTIFICATIONS` permission declared in `app.json` and requested at runtime in `app/_layout.tsx` for Android 13+
17. **Albums tab auto-refresh** — added `lib/albumEvents.ts` event bus (mirroring `historyEvents`); `addAlbum`/`removeAlbum` in `database.ts` notify on change; `useAlbums()` subscribes so the Library Albums tab updates reactively without manual refresh
88. **Search results scroll fix** — migrated `Library.tsx` from `songs.map()` inside a plain `View` to `FlatList`; removed `alignItems: "center"` squeezing items. **Web Layout Fix**: Addressed a React Native Web edge-case where `FlatList` containers stretch infinitely (causing clipping instead of scrolling) because Expo Router wraps screens in an unconstrained DOM element, breaking the Flexbox `min-height` shrink chain. Fixed globally by applying `...StyleSheet.absoluteFillObject` to the main container styles in `App.tsx`, `playlists.tsx`, and `playlist/[id].tsx`, explicitly pinning the screen containers to the browser viewport bounds and forcing the `FlatList` to scroll.
89. **Unified Add to Playlist Modal & Playlist Reactivity** — centralized the playlist modal via `LikeModalContext` to manage visibility, track payload, and optimistic UI updates for `isLiked` cache. Introduced `playlistEvents.ts` to sync global state on DB mutations, allowing `usePlaylists` to stay updated without manual refresh.

### Known Issues

- Some YouTube Music catalog videos (e.g., `-uqZlkSoEZU`, `68-LByyHfpc`) return 403 for audio-only formats; format-18 combined fallback works but wastes bandwidth on video data.
- yt-dlp resolution adds ~3s latency on first request (cached for 5 min after that).

### Next Up (priority order)

1. **Android dev build** — generate APK/AAB via `eas build --platform android` for physical device testing
2. **Background playback on Android** — notification/lock-screen controls implemented; verify background audio still plays while app is in the background
3. **Queue improvements** — play a playlist → queue all tracks, skip next/previous within playlist
4. **Android notification verification** — notification and lock-screen play/pause/skip/seek/stop implemented; physically verify they work correctly on the device
5. **Physical device testing** — LAN IP backend URL, background audio, battery impact, streaming stability
6. **Polish** — loading skeletons, pull-to-refresh on search, playlist reordering, swipe-to-delete

## Constraints

- Android is the first supported platform (iOS requires Mac signing).
- Web is UI-only — `<audio>` works for basic playback but no background mode.
- `localhost` does not point to a development computer from a physical phone; use LAN IP.
- Stream URL availability varies by content, region, and upstream YouTube Music changes.
- Usage must comply with YouTube terms and applicable content licensing requirements.

