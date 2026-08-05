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
│   ├── playback-session.ts # Active source, collection, queue, and index
│   ├── track-player.ts   # React Native Track Player wrapper/controller
│   └── playback.ts       # Top-level shared playback navigation & formatting
└── backend/              # Python FastAPI + ytmusicapi service
```

## Playback Flow

The playback pipeline is strictly unidirectional. The UI never directly calls `TrackPlayer` methods for enqueueing audio.

**Flow:**
`UI` (Search, History, Album, etc) → `playback.ts` → `playQueue()` → `TrackPlayer`

- **`UI`**: Owns navigation and user interactions. Components call `playAndOpenPlayer` or `playCollection`, both of which create a queue through the shared playback manager.
- **`TrackPlayer`**: Owns the queue and audio state. (React Native Track Player).
- **`track-player.ts`**: The strict adapter layer. It provides the universal `playQueue` pipeline and abstracts away whether the environment is Native or Web. It automatically writes successfully played tracks to the History database.
- **`playback.ts`**: Handles pre-processing tracks (fetching stream proxy URLs via `api.ts`, transforming metadata) before passing them to `track-player.ts`.
- **Playback scope**: Search results and history use a one-track `playQueue()` session. Albums and playlists use the same function with a longer queue.
- **Queue selection**: `playQueue()` explicitly skips to the requested collection index after adding the queue. The return value of `TrackPlayer.add()` is not used as the active-track index.
- **Command serialization**: `track-player.ts` coalesces overlapping play/pause commands, while the existing playback mutex and play IDs prevent competing queue/track loads from reaching the native player.
- **Repeat handling**: Native playback uses one guarded JavaScript end-of-track controller because this fork can pause at track end instead of transitioning reliably. Web playback retains its HTML audio `onended` handling, and the backend keeps resolved stream URLs cached for five minutes.
- **Repeat states**: Collections support `off`, `queue` (Loop), and `track` (Loop 1); single-track sessions expose only `off` and `track`.
- **Stream format**: The backend uses progressive format 18 for compatibility with GoogleVideo restrictions, keeps a 32-entry LRU URL cache with a five-minute TTL, and prefetches only the next queued track.
- **Playback session**: `playback-session.ts` owns source, collection metadata, queue, and current index. React uses `usePlaybackSession()` separately from the playback state hooks.
- **Search filters**: Search fetches songs and albums concurrently but renders only the selected `Songs` or `Albums` result set.
- **Album screen layout**: The album track list and mini-player use normal layout flow so the mini-player cannot cover the final album tracks.

### State Management Boundaries

To prevent React performance issues, the global playback state is split into three highly specialized hooks in `hooks/usePlaybackState.ts`:
1. `useActiveTrack()`: Exposes `track` and `error` state. Used by screens to display artwork and titles.
2. `usePlaybackProgress()`: Exposes `position` and `duration`. Subscribed to *only* by Seek bars / Progress bars to prevent re-rendering massive component trees every second.
3. `usePlaybackControls()`: Exposes control triggers (`togglePlayPause`, `skipToNext`, `skipToPrevious`) and `isPlaying` boolean.
4. `usePlaybackSession()`: Exposes the active source, collection metadata, queue, and current queue index without mixing collection data into playback hooks.

## Database

Persistence is handled exclusively by SQLite using `expo-sqlite`. Migrations run synchronously on application boot (`initDb`).

### Current Schema (v2)
- **`playlists`**: User-created playlists.
- **`playlist_tracks`**: Junction table for tracks within a playlist.
- **`recent_plays`**: The user's listening history.
- **`playback_session`**: The current playback source, collection metadata, queue, and queue index.
- **`saved_albums`**: Albums saved by the user to their library.

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

- **Downloads (v3)**: Offline storage of `.m4a`/`.mp3` buffers using `expo-file-system`, storing local file URIs in the database, and providing a unified UI for online vs offline playback.

## Design System & Color Palette

Songify uses a consistent, custom color theme (based on a "Tokyo Night" aesthetic) defined in `constants/theme.ts`.

| Token | Hex Value | Usage / Meaning |
|-------|-----------|-----------------|
| `text` | `#c0caf5` | Primary body text and headers |
| `subtext` | `#a9b1d6` | Secondary text, subtitles, and inactive icons |
| `main` | `#24283b` | App background, primary screen background |
| `sidebar` | `#1f2335` | Sidebar, modals, or elevated surfaces |
| `player` | `#1f2335` | Bottom tab bar and Now Playing bar |
| `card` | `#1f2335` | Cards, buttons, inputs, and list items |
| `shadow` | `#101010` | Box shadows and depth gradients |
| `selectedRow` | `#e0af68` | Highlighted/active row state (e.g. playing track) |
| `button` | `#ff9e64` | Primary brand color: buttons, active tabs, checkmarks |
| `buttonActive` | `#ff9e64` | Pressed state for buttons |
| `buttonDisabled` | `#45475A` | Disabled button background |
| `tabActive` | `#ff9e64` | Active state indicator for Bottom Tabs |
| `notification` | `#ff9e64` | General badges or system notifications |
| `notificationError` | `#f7768e` | Error states, delete actions (e.g. trash icon) |
| `misc` | `#ff9e64` | Miscellaneous highlights |
