# Issue Fixes Archive

This document contains a running log of all major issues diagnosed and fixed throughout the development of the app.

---

## 1. SQLite Native Bridge Crash on Null Values (expo-sqlite v15.2.14)
**The Issue:** The app would instantly crash natively when passing `null` parameters in `db.runAsync()` (e.g. `track.album` or `track.durationMs`). This occurred because the `expo-modules-core` Kotlin bridge strictly expected a `Map<String, Any>` (where `Any` is non-nullable), rejecting the JS `null` object entirely with `Cannot convert '[object Object]' to a Kotlin type`.
**The Fix:** Scrubbed all potentially null parameters in our database wrappers (`addToHistory`, `addTrackToPlaylist`), coalescing them to safe default values (`""` for strings and `0` for numbers) before passing them to `expo-sqlite`, ensuring the Kotlin bridge type-checker passes smoothly.

## 2. Native Audio Speedup & Auto-Play Bug Fix
**The Issue:** The native audio engine (ExoPlayer/TrackPlayer) would occasionally double the playback speed or glitch if multiple `play()` commands were issued simultaneously (e.g. rapid tapping). Additionally, tracks clicked from History were failing to auto-play because the previous `safePlay` wrapper suppressed the `play()` command if the player entered a `Buffering` state.
**The Fix:** Removed the `safePlay` wrapper and introduced a strict, asynchronous `latestPlayId` concurrency lock directly inside `playTrack`. If multiple track loads overlap asynchronously, the `latestPlayId` check cleanly aborts the stale executions, allowing only the final requested track to initialize and explicitly call `TrackPlayer.play()`, guaranteeing flawless auto-play and eliminating bridge races.

## 3. Unified Playback Architecture
**The Issue:** UI components like `Search`, `App` (Library), and `PlayerScreen` all contained duplicate logic to fetch stream metadata, manage `AbortController`s, and control `TrackPlayer` directly. This caused UI components to act as playback controllers, leading to unhandled navigation errors (`GO_BACK`) and broken playback in Continue Listening.
**The Fix:** Centralized all playback initialization into a single `lib/playback.ts` service with `playAndOpenPlayer` and `loadAndPlayTrack`. UI components (Search, Continue Listening, Library) now passively trigger this unified pipeline. `PlayerScreen` was refactored into a completely passive UI observer that solely relies on `getActiveTrack()`, safely rendering whatever TrackPlayer is currently playing and safely validating `router.canGoBack()` for backwards navigation.

## 4. Search Queue Selection & Rapid Play Tap Fix
**The Issue:** Selecting a search result other than the first could still start the first queued track. This happened because the return value of `TrackPlayer.add()` was treated as the selected track index, even though it represents an insertion result and is not the requested active index. Rapid taps on play/pause during buffering could also send overlapping native `play()` commands.
**The Fix:** `playQueue()` now explicitly skips to the requested queue index after adding the tracks. `togglePlayPause()` coalesces overlapping commands so repeated taps during a delayed start do not issue duplicate native commands. Routine setup checks now use debug logging instead of warning-level diagnostics.

## 5. Search Filters, Safe Navigation & Album Layout
**The Issue:** Search displayed songs and albums in one combined list, standalone back buttons could dispatch `GO_BACK` without navigation history, and the album screen mini-player could cover the final track rows.
**The Fix:** Search now has separate Songs and Albums filters with independent loading states. Back actions fall back to the home route when necessary. The album mini-player is part of the normal layout flow below the track list.

## 6. Album Queue Repeat Behavior
**The Issue:** Album playback needed to continue through the queued album tracks and support both whole-queue repeat and repeat-one without treating search results as an album queue.
**The Fix:** Album and playlist playback use collection queues, while Search and History use solo playback. Queue repeat restarts at index zero and repeat-one restarts the active queue index through the JavaScript fallback; resolved proxy stream URLs remain cached by the backend.

## 7. Reliable Repeat States & Ended Playback
**The Issue:** The native fork could enter `Paused` when a track ended instead of advancing. Native repeat was also unreliable for distinguishing a solo loop from collection loop-one.
**The Fix:** Added one guarded end-of-track controller. Collections support Off, Loop, and Loop 1; solo tracks support Off and Loop. The controller checks the active queue index and end position before advancing, so manual pauses are preserved.

## 8. Progressive Format Compatibility
**The Issue:** GoogleVideo rejected audio-only itag 251 requests from the current ExoPlayer integration because its initial request has no bounded Range header. Progressive format 18 succeeds under the same request path.
**The Fix:** The backend now uses format 18 directly for normal playback and prefetching, while retaining format diagnostics for future controlled experiments.

## 9. SQLite Missing Column & Hot Reload Migration Crash
**The Issue:** The "Add Album" feature crashed on insert because the `thumbnailUrl` column was missing from existing tables. During React Native hot reloading, the database initialization mistakenly skipped migrations because `db` and `initDbPromise` were preserved across reloads. This caused "no such column" errors when queries ran on-mount before the database schema was validated.
**The Fix:** Bumped `user_version` to 2 to force migration, explicitly destroyed database cache variables on file reload (`db = null; initDbPromise = null;`), restored missing playlist functions from git history, and guarded all startup hooks (`useHistory`, `usePlaylists`, `usePlaybackSession`) with `await initDb()` to guarantee they never fetch before the database is ready.

## 10. App Restart Playback Crash & Session Expiration
**The Issue:** Tracks loaded via search or history saved their direct streaming URLs to the native TrackPlayer queue and SQLite database. These direct URLs contain expiration tokens from YouTube/Invidious (valid for ~24 hours). When reopening the app later, pressing Play would cause the player to crash while attempting to load the expired URL.
**The Fix:** Updated `getPlaybackTrack` in `lib/api.ts` to strictly route all `streamUrl`s through the app's internal `/proxy/audio/` route, guaranteeing unexpired, on-demand resolution natively. Additionally, added a sanitization layer in `hooks/usePlaybackState.ts` that intercepts legacy queues from SQLite on startup, overriding any old direct URLs with proxy URLs to instantly repair broken persistent sessions.

## 11. Native Queue Silent Failure on OS Service Kill
**The Issue:** When the app is backgrounded for long periods, the Android OS silently kills the `react-native-track-player` background service to save memory. Since the UI restores its active track from SQLite on boot, tapping play on the mini-player attempts to play from an empty native queue, resulting in a silent failure (logs show `ensureSetup: natively ready` but no playback).
**The Fix:** Updated `togglePlayPause`, `skipToNext`, and `skipToPrevious` in `lib/track-player.ts` to perform a robust safety check. If the native queue is empty upon user interaction, it instantly grabs the persisted JavaScript session and seamlessly reconstructs the native queue behind the scenes, allowing playback to flawlessly resume where it left off.

## 12. Playlist Deletion Missing Confirmation Dialog
**The Issue:** In the Library tab (`app/(tabs)/library.tsx`), tapping the trash icon next to a user-created playlist instantly and permanently deleted the playlist without any confirmation, unlike the individual playlist screen which properly prompted the user.
**The Fix:** Wrapped the `remove(item.id)` action in `library.tsx` with a native `Alert.alert` that prompts "Are you sure you want to delete this playlist?", ensuring destructive actions require explicit user confirmation across all app surfaces.
## 13. Proxy Audio Timeout & Format Fallbacks
**The Issue:** Playing un-prefetched tracks caused the native audio player to time out because the backend `yt-dlp` extraction took longer than the native player's 10-second connection timeout, resulting in an `error` state. Additionally, strictly audio-only releases lacked YouTube's format `18`, crashing the proxy if fallback logic wasn't in place. Lastly, `206 Partial Content` responses omitting `Content-Type` triggered 502 errors on cache hits.
**The Fix:** 
1. `lib/track-player.ts` now explicitly `await prefetchAudioUrl` right before passing the track to the native player, ensuring JS waits for extraction and hits the cache instantly when native playback begins.
2. The backend proxy seamlessly falls back to audio-only formats (`bestaudio`) if format `18` is unavailable.
3. The proxy utilizes the cached `upstream_ct` during `206` responses if the CDN omits the header, preventing `502` errors when scrubbing or resuming playback.
