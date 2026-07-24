# Songify Implementation Plan

## Product Goal

Build an Android-first, Spotify-inspired music application that searches YouTube Music metadata through `ytmusicapi`, plays a fresh audio stream while running in the background, and lets users create device-local playlists.

## Technology Stack

### Mobile Application

- React Native 0.81 with Expo SDK 54
- TypeScript with strict compiler settings
- Expo Router for application routes
- React Native Track Player for the audio queue, Android background playback, notification controls, and lock-screen controls
- Expo SQLite for local playlists and saved track metadata
- Expo development builds for Android device testing because Track Player includes native code and cannot run in Expo Go

### Backend

- Python 3
- FastAPI for HTTP endpoints
- Uvicorn for local and production ASGI serving
- ytmusicapi for YouTube Music search, metadata, and temporary playback stream information
- Pydantic models for request validation and stable API responses

### Quality and Tooling

- ESLint with Expo configuration
- TypeScript compiler validation
- Pytest for backend response-mapping and endpoint tests
- Git for source control

## Architecture

The React Native application calls a backend over HTTP(S). The backend calls `ytmusicapi`; the mobile application must not directly depend on it.

Search results use durable IDs and metadata. When a user presses play, the app requests a fresh playback URL using the selected `videoId`. Temporary playback URLs must not be written to the device database because they expire.

Local playlists store names, ordering, `videoId`, title, artists, duration, and thumbnail URL using SQLite. Cloud synchronization, accounts, and offline downloads are out of scope for the first release.

## Backend API

### `GET /health`

Returns an availability response for the mobile app and development checks.

### `GET /search?q=<query>`

Validates the query and returns normalized track results:

```json
{
  "items": [
    {
      "videoId": "string",
      "title": "string",
      "artists": ["string"],
      "album": "string or null",
      "durationMs": 0,
      "thumbnailUrl": "string or null"
    }
  ]
}
```

### `GET /tracks/:videoId/playback`

Uses `YTMusic.get_song(videoId)`, selects an audio-only stream format, and returns a fresh stream URL and track metadata. It must report unavailable content and upstream failures with clear HTTP errors.

## Delivery Milestones

1. Create the FastAPI backend with normalized search, playback, health endpoints, validation, and tests.
2. Replace the current hard-coded `localhost` request with a configurable, typed API client in the mobile app.
3. Add debounced search with loading, empty, unavailable, and network-error states.
4. Install and configure React Native Track Player in an Android development build.
5. Add a queue, now-playing bar, full player controls, progress display, and Android background service.
6. Add SQLite migrations and playlist operations: create, rename, delete, add track, remove track, and reorder track.
7. Add playlist library and playlist-detail screens using the existing Spotify-inspired visual direction.
8. Verify linting, TypeScript, backend tests, search behavior, persisted playlists, and background playback on a physical Android device.

## Constraints

- Android is the first supported platform.
- The application needs a reachable backend URL. `localhost` does not point to a development computer from a physical phone.
- Stream URL availability can vary by content, region, login state, and upstream YouTube Music changes.
- Usage must comply with YouTube terms and applicable content licensing requirements.
