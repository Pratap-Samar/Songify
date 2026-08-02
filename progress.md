# Project Progress & Fixes

## 1. Theme & UI Overhaul (Sunset-Swing)
- **Centralized Theme**: Created `constants/theme.ts` to hold the "sunset-swing" color palette, mapping out roles like `main` (`#24283b`), `card`/`player` (`#1f2335`), `text` (`#c0caf5`), and `button` (`#ff9e64`).
- **Global Backgrounds**: Replaced `LinearGradient` components with standard `View` components using the solid `main` background across all top-level screens (`App.tsx`, `PlayerScreen.tsx`, `playlists.tsx`, `playlist/[id].tsx`).
- **Component Styling**: 
  - Updated `Library.tsx` to use the `card` background for items and added a highlighted state (`selected-row`: `#e0af68`) for the currently playing track.
  - Styled `NowPlayingBar.tsx` as a solid bottom bar with a thin, top-aligned progress track using the `buttonDisabled` and `button` colors.
  - Updated `SearchBar.tsx` to use `card` background and distinct focus styles.
  - Ensured all secondary text uses `subtext` (`#a9b1d6`) and errors use `notificationError` (`#f7768e`).

## 2. PlayerScreen Redesign
- Fully redesigned `PlayerScreen.tsx` to feature a modern, Apple Music/Spotify-style layout.
- Added a **Repeat / Loop button** that correctly cycles between `off`, `queue`, and `track` modes.
- Added an **Add to Playlist button** that brings up a new bottom-sheet style modal (`AddToPlaylistModal.tsx`) so users can add tracks to playlists without leaving the player.
- Improved the seek bar (progress bar) and playback controls.

## 3. Mini Player (NowPlayingBar) Sync Fix
**The Issue:** The mini player wasn't updating when a track started playing or when playback state changed; it just showed the initial state ("No track selected").
**The Fix:** We refactored `NowPlayingBar.tsx` to subscribe to real-time events from our player logic (`lib/track-player.ts`). By using `getActiveTrack`, `addPlaybackStateListener`, `addTrackChangeListener`, and `addProgressListener`, the component now maintains its own internal state and reactively updates immediately whenever the player state changes anywhere in the app.

## 4. Web Scrolling Fix
**The Issue:** The search results `FlatList` would clip and refuse to scroll on Expo Web when the results overflowed the visible window height.
**The Fix:** Updated `app/+html.tsx` (the root HTML template for web) to inject a global style on `body` and `html` ensuring `height: 100%`, `width: 100%`, and `overflow-y: hidden`. We also ensured the root `View` in `App.tsx` has `flex: 1` and `StyleSheet.absoluteFillObject`. This allowed React Native's `FlatList` to handle the internal scrolling correctly rather than the browser body trying (and failing) to scroll.

## 5. Mini Player (NowPlayingBar) Navigation & Touch Bubbling Fix
**The Issue:** Tapping the mini player was failing to navigate correctly to the full player if the global `App.tsx` state was stale (e.g. from auto-play next). Furthermore, tapping the inner buttons (Play/Pause) was incorrectly bubbling touches to the outer bar's navigation event.
**The Fix:** Refactored `NowPlayingBar` to handle its own navigation logic relying purely on its internal `activeTrack` state. Implemented `e.stopPropagation?.()` on all the inner control buttons to safely consume touch events before they bubble up to the navigation container.

## 6. PlayerScreen Mount State Fix
**The Issue:** Whenever you navigated back to the player screen for a track that was *already* playing, it would instantly restart the audio stream from `0:00`. This happened because `PlayerScreen.tsx` was unconditionally re-fetching the track details and executing `playTrack(result)` on every mount.
**The Fix:** Added a new `getPlaybackState()` function to `lib/track-player.ts`. Updated the `PlayerScreen`'s mount `useEffect` to first query the current `getActiveTrack()`. If the active track matches the player's route `videoId`, the component simply attaches its UI state to the existing audio session without restarting or interrupting playback.

## 7. Image Proxy for Opaque Response Blocking (ORB)
**The Issue:** Official song thumbnails sourced from `yt3.googleusercontent.com` with the `=w120-h120-l90-rj` suffix were returning `200 OK` in CURL but universally failing to load on web via React Native's `<Image>` tag due to an Opaque Response Block (ORB) caused by strict Cross-Origin Resource Policies on Google's image CDNs.
**The Fix:** Created a local backend endpoint (`/proxy/image?url=...`) with domain validation (allowlisting YouTube/Google image CDNs), robust timeout handling, and a 5-minute in-memory cache. Updated the frontend `searchTracks` and `getPlaybackTrack` in `lib/api.ts` to automatically route all thumbnail URLs through this proxy, resolving all image blocking safely.

## 8. Web Repeat Modes & Local Queue Implementation
**The Issue:** The Web player's `audio.loop = true` approach broke heavily with byte-range streams, causing tracks to just stop silently instead of repeating. Furthermore, `repeat-all` (Queue) functioned exactly like `repeat-one` because the Web implementation dropped the full track array instantly upon playback.
**The Fix:** 
- Stripped `audio.loop` from Web and manually intercepted `a.onended`. 
- For `repeat-one`, the handler safely rewinds the existing `<audio>` element (`currentTime = 0; play()`), preserving the network byte-stream instead of re-resolving a new URL.
- Scaffolded basic Web Queue state (`webQueue` and `webQueueIndex`) directly in `lib/track-player.ts`.
- Rewrote the Web `skipToNext()` and `skipToPrevious()` handlers to advance through `webQueue` and loop around safely when `repeat-all` is toggled. `onended` now successfully triggers `skipToNext()` when the track ends, fully replicating Native's `RepeatMode.Queue` behavior.
