# Songify Architecture

This document describes the current architecture and boundaries for Songify. It is intended as a source of truth for understanding how the playback engine interacts with the user interface and the local SQLite database.

## Project Structure

```
d:\Project\Songify
├── app/                  # Expo Router filesystem routing (UI)
│   ├── (tabs)/           # Main navigation tabs (Home, Search, Library)
│   ├── album/            # Dynamic album view ([id].tsx)
│   └── playlist/         # Dynamic playlist view ([id].tsx)
├── components/           # Reusable presentational components (NowPlayingBar, Library, PlayerScreen)
├── constants/            # Theme, colors, layout constants
├── hooks/                # Custom React hooks (usePlaybackState, usePlaylists)
├── lib/                  # Core logic, managers, and API connectors
│   ├── api.ts            # Connector for ytmusicapi/backend
│   ├── database.ts       # SQLite persistence and migrations
│   ├── logger.ts         # Centralized development logger
│   ├── track-player.ts   # React Native Track Player wrapper/controller
│   └── playback.ts       # Top-level shared playback navigation & formatting
└── backend/              # Python FastAPI + ytmusicapi service
```

## Playback Flow

The playback pipeline is strictly unidirectional. The UI never directly calls `TrackPlayer` methods for enqueueing audio.

**Flow:**
`UI` (Search, History, Album, etc) → `playback.ts` → `track-player.ts` → `TrackPlayer`

- **`UI`**: Owns navigation and user interactions. Components call `playAndOpenPlayer` or `playCollection` which handles bridging the gap between track arrays and the playback manager.
- **`TrackPlayer`**: Owns the queue and audio state. (React Native Track Player).
- **`track-player.ts`**: The strict adapter layer. It provides `playTrack` and `playQueue` and abstracts away whether the environment is Native or Web. It automatically writes successfully played tracks to the History database.
- **`playback.ts`**: Handles pre-processing tracks (fetching stream proxy URLs via `api.ts`, transforming metadata) before passing them to `track-player.ts`.
- **Queue selection**: `playQueue()` explicitly skips to the requested collection index after adding the queue. The return value of `TrackPlayer.add()` is not used as the active-track index.
- **Command serialization**: `track-player.ts` coalesces overlapping play/pause commands, while the existing playback mutex and play IDs prevent competing queue/track loads from reaching the native player.

### State Management Boundaries

To prevent React performance issues, the global playback state is split into three highly specialized hooks in `hooks/usePlaybackState.ts`:
1. `useActiveTrack()`: Exposes `track` and `error` state. Used by screens to display artwork and titles.
2. `usePlaybackProgress()`: Exposes `position` and `duration`. Subscribed to *only* by Seek bars / Progress bars to prevent re-rendering massive component trees every second.
3. `usePlaybackControls()`: Exposes control triggers (`togglePlayPause`, `skipToNext`, `skipToPrevious`) and `isPlaying` boolean.

## Database

Persistence is handled exclusively by SQLite using `expo-sqlite`. Migrations run synchronously on application boot (`initDb`).

### Current Schema (v1)
- **`playlists`**: User-created playlists.
- **`playlist_tracks`**: Junction table for tracks within a playlist.
- **`recent_plays`**: The user's listening history.

### Ownership & Relationships
- **History Ownership**: `track-player.ts` owns inserting to `recent_plays`. The UI only reads from it.
- **Playlist Ownership**: The UI (`usePlaylists` hook) owns writing and reading to `playlists` and `playlist_tracks`.
- **Foreign Keys**: `playlist_tracks` uses `FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE`.
- **Constraints**: `playlist_tracks` uses a composite Primary Key of `(playlistId, videoId)`.

## API

Songify connects to a Python FastAPI backend running `ytmusicapi` to stream high-quality metadata.

- **`searchTracks`**: Searches for songs and albums using concurrent fetches.
- **`getPlaybackTrack`**: Used to fetch full track metadata.
- **`getAudioProxyUrl`**: The backend streams the raw audio buffer which the frontend Native player streams directly using the proxy URL.

## Upcoming Modules (Future Phases)

*Note: These modules are planned but do not yet exist in code.*

- **Saved Albums (v2)**: Fetching an album once, storing its metadata locally, and making it available in the Library tab.
- **Downloads (v3)**: Offline storage of `.m4a`/`.mp3` buffers using `expo-file-system`, storing local file URIs in the database, and providing a unified UI for online vs offline playback.
