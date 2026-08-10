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

## 9. Playback Performance / Stuttering Fix
**The Issue:** Playing a track caused massive unnecessary UI blocking (the spinner would hang for 3-6 seconds) and severe CPU waste on the backend. This was due to React 18's Strict Mode double-mounting causing duplicate fetch requests, combined with the backend `/playback` route synchronously executing `yt-dlp` twice (once to verify the stream, and again when the audio player actually requested the proxy stream).
**The Fix:** Added an `AbortSignal` in `PlayerScreen.tsx` to immediately cancel redundant fetches. Removed the redundant synchronous `resolve_stream_url` call from the `/playback` route in `main.py`, allowing metadata to return instantly and leaving the single cached `yt-dlp` execution entirely up to the `/proxy/audio` route.

## 10. Play/Pause Icon UI Sync Fix
**The Issue:** The play/pause icon on both the mini-player and full-screen player would permanently remain stuck on "Play" even while audio was playing.
**The Fix:** The `TrackPlayer` fork's native listener emits the raw enum value in lowercase (e.g. `"playing"`, `"paused"`), but the UI explicitly checked for capitalized strings (`"Playing"`). Updated `addPlaybackStateListener` in `lib/track-player.ts` to map the raw lowercase strings to the capitalized strings expected by the UI.

## 11. Native Android Repeat Mode / Proxy Audio Stalling Fix
**The Issue:** When looping was enabled on a single track, the native Android player (`ExoPlayer`) would silently intercept the end of the queue and attempt to repeat the track internally by seeking the stream back to `0:00`. This caused the backend proxy connection to stall or fail to resume, resulting in the audio silently stopping without emitting a `PlaybackQueueEnded` event. Furthermore, the `KotlinAudio` implementation in the fork had completely swapped the ordinal values for `RepeatMode.Track` and `RepeatMode.Queue`, causing the opposite loop behavior natively.
**The Fix:** Completely bypassed Native RepeatMode by modifying `setRepeatMode` in `lib/track-player.ts` to ALWAYS tell the native player that Repeat Mode is `Off`. This guarantees that `ExoPlayer` cleanly reaches the end of the track and consistently fires `PlaybackQueueEnded`. A Javascript fallback listener then catches this event and manually restarts playback via `TrackPlayer.skip(0)` and `TrackPlayer.play()`, completely avoiding the proxy seeking bug and rendering the native ordinal mismatch irrelevant.

## 12. SQLite Native Bridge Crash on Null Values (expo-sqlite v15.2.14)
**The Issue:** The app would instantly crash natively when passing `null` parameters in `db.runAsync()` (e.g. `track.album` or `track.durationMs`). This occurred because the `expo-modules-core` Kotlin bridge strictly expected a `Map<String, Any>` (where `Any` is non-nullable), rejecting the JS `null` object entirely with `Cannot convert '[object Object]' to a Kotlin type`.
**The Fix:** Scrubbed all potentially null parameters in our database wrappers (`addToHistory`, `addTrackToPlaylist`), coalescing them to safe default values (`""` for strings and `0` for numbers) before passing them to `expo-sqlite`, ensuring the Kotlin bridge type-checker passes smoothly.

## 13. Native Audio Speedup & Auto-Play Bug Fix
**The Issue:** The native audio engine (ExoPlayer/TrackPlayer) would occasionally double the playback speed or glitch if multiple `play()` commands were issued simultaneously (e.g. rapid tapping). Additionally, tracks clicked from History were failing to auto-play because the previous `safePlay` wrapper suppressed the `play()` command if the player entered a `Buffering` state.
**The Fix:** Removed the `safePlay` wrapper and introduced a strict, asynchronous `latestPlayId` concurrency lock directly inside `playTrack`. If multiple track loads overlap asynchronously, the `latestPlayId` check cleanly aborts the stale executions, allowing only the final requested track to initialize and explicitly call `TrackPlayer.play()`, guaranteeing flawless auto-play and eliminating bridge races.

## 14. Unified Playback Architecture
**The Issue:** UI components like `Search`, `App` (Library), and `PlayerScreen` all contained duplicate logic to fetch stream metadata, manage `AbortController`s, and control `TrackPlayer` directly. This caused UI components to act as playback controllers, leading to unhandled navigation errors (`GO_BACK`) and broken playback in Continue Listening.
**The Fix:** Centralized all playback initialization into a single `lib/playback.ts` service with `playAndOpenPlayer` and `loadAndPlayTrack`. UI components (Search, Continue Listening, Library) now passively trigger this unified pipeline. `PlayerScreen` was refactored into a completely passive UI observer that solely relies on `getActiveTrack()`, safely rendering whatever TrackPlayer is currently playing and safely validating `router.canGoBack()` for backwards navigation.

## 15. Search Queue Selection & Rapid Tap Fix
- Search and album collections now use the caller-provided queue index directly when starting playback. The result of `TrackPlayer.add()` is no longer mistaken for the selected track index.
- Play/pause requests are coalesced while a previous command is pending, preventing repeated taps during buffering from issuing overlapping native commands.
- Repeated player setup checks remain shared through one setup promise and are logged at debug level during normal operation.

## 16. Search Result Filters & Safe Navigation
- Added separate `Songs` and `Albums` filters to the Search screen, defaulting to Songs and rendering only the selected result type.
- Song and album searches maintain independent loading states so switching filters does not show a false empty state while the selected request is pending.
- Back buttons on Search, Album, Playlist, and About screens now fall back to the home route when no navigation history exists, preventing unhandled `GO_BACK` actions.

## 17. Album Playback Layout & Repeat Handling
- Album playback keeps the full album queue, allowing native playback to advance through tracks without another play press.
- Queue repeat restarts the album from its first track, while repeat-one repeats only the active track. Solo tracks remain separate from album and playlist queues.
- The album screen mini-player now occupies normal layout space below the track list instead of overlaying the final rows and controls.

## 18. Playback Session & Universal Queue
- Added a dedicated playback session store for the active source, collection metadata, queue, and current queue index.
- Search/history single tracks now use the same `playQueue()` pipeline as albums and playlists with a queue of length one.
- Added a separate `usePlaybackSession()` hook so collection metadata does not enter the playback state hooks.
- Persisted the current session in SQLite schema v2 without changing Continue Listening history behavior.
- Added an explicit native end-of-track controller because the fork can enter `Paused` at the end of a track instead of transitioning. It advances albums, repeats the current track for loop-one, and restarts the album for loop-all while ignoring manual mid-track pauses.

## 19. Final Repeat State Behavior
- Collection playback exposes `Off`, `Loop`, and `Loop 1` behavior.
- Solo playback exposes only `Off` and `Loop`; loop repeats its one-track queue.
- End handling checks the active queue index and playback position, so a manual pause during a song is not mistaken for a completed track.

## 20. Stream Quality & Prefetch Optimization
- The proxy uses combined progressive format 18 because GoogleVideo rejects the audio-only request pattern used by the current ExoPlayer integration.
- Cache hits/misses and upstream response status remain logged for operational troubleshooting.
- Resolved stream URLs use a 32-entry LRU cache with the existing five-minute TTL; audio bytes are not stored locally.
- The next album or playlist track is prefetched into the backend URL cache without downloading the audio file to the device.

## 21. Add Album Feature & Database Hot Reload Migration Crash
- **The Issue:** The "Add Album" feature was implemented but crashed on the `saved_albums` insert because of a missing `thumbnailUrl` column in existing tables. During React Native hot reloading, the database initialization mistakenly skipped migrations because the connection state (and `initDbPromise`) was preserved, leading to "no such column" errors when queries ran on-mount before the database schema could be reliably verified or updated.
- **The Fix:** Implemented a `user_version = 2` schema migration and explicitly destroyed the database cache variables on file reload (`db = null; initDbPromise = null;`). Restored missing playlist functions from git history, and guarded all startup hooks (`useHistory`, `usePlaylists`, `usePlaybackSession`) with `await initDb()` to guarantee they never fetch before the database is ready. 

## 22. Liked Songs System & Player UI Polish
- **Liked Songs Database logic**: Updated the SQLite `playlists` table to include an `isSystem` flag. Auto-generated a "Liked Songs" playlist that pins to the top of the Library and is immune to renaming/deletion.
- **Heart Button Integration**: Swapped the generic 'Add' button in the player and album screens with a direct `toggleLike` Heart button (styled with `accent.like` `#ff3366` and a crisp text-shadow stroke). Added a snackbar for non-intrusive feedback when liking a song.
- **Artwork Shadow & Status Ring**: Restructured `PlayerScreen` artwork to properly cast a drop shadow across both iOS and Android (via `elevation` combined with a non-transparent `backgroundColor`). Added a responsive 4px cyan (`accent.link`) border on the artwork that animates seamlessly to indicate playback status without relying on large neon backgrounds or layout shifts.
- **Repeat Icon weight**: Enhanced the repeat icon stroke width using text shadows to ensure it carries appropriate visual weight against the other player controls.

## 23. Android Media Notification & Lock-Screen Controls
- **Notification Capabilities**: Configured `updateOptions` in `lib/track-player.ts` to enable `Play`, `Pause`, `Stop`, `SeekTo`, `Skip`, `SkipToNext`, and `SkipToPrevious` as notification capabilities, plus compact (collapsed) capabilities (`Play`, `Pause`, `SeekTo`, `Skip`).
- **Remote event listeners**: Added handlers in `playback-service.ts` for `RemotePlay`, `RemotePause`, `RemoteNext`, `RemotePrevious`, `RemoteSeek` (tapping the notification seek bar now works), and `RemoteStop` (resets the player and clears the playback session) so the notification and lock-screen controls drive playback.
- **Track metadata populates the notification**: `mapTrack()` in `lib/track-player.ts` passes `title`, `artist`, `artwork`, and `duration` when adding tracks to the player, which populates the notification with album art, title, and artist.
- **POST_NOTIFICATIONS permission (Android 13+)**: Declared `android.permission.POST_NOTIFICATIONS` in `app.json` permissions and added a runtime `PermissionsAndroid.request()` call in `app/_layout.tsx`'s startup `useEffect`. This is required on Android 13+ — without it the media notification silently never appears.

## 24. Albums Tab Auto-Refresh
- **The Issue:** Adding or removing a saved album from the album screen (`app/album/[id].tsx`) didn't update the Albums tab in `app/(tabs)/library.tsx` until a manual soft-refresh — because `useAlbums()` only fetched albums on mount and the album screen called `addAlbum`/`removeAlbum` directly from `lib/database.ts`, bypassing the hook's refresh.
- **The Fix:** Added `lib/albumEvents.ts`, a small event bus mirroring the existing `lib/historyEvents.ts` pattern (`subscribeToAlbumsChanged` / `notifyAlbumsChanged`). `addAlbum` and `removeAlbum` in `lib/database.ts` now call `notifyAlbumsChanged()`, and `useAlbums()` subscribes via the new module so its list re-fetches automatically whenever an album is saved or removed from anywhere in the app — no navigation-focus hacks or manual refreshes needed.

## 25. Unified Add to Playlist Modal & Playlist Reactivity
- **The Issue:** Heart icons and 	oggleTrackLike logic were spread across PlayerScreen and  lbum/[id].tsx, requiring duplicate Snackbar and AddToPlaylistModal renders in every screen. Playlists tab (Library.tsx) wasn't reactively updating when a track was added/removed to a playlist inside the modal.
- **The Fix:**
  - Created LikeModalContext to centralize the modal's visibility state and track payload, mounted at the root _layout.tsx so the modal is only rendered once.
  - Introduced playlistEvents.ts (a publish-subscribe event bus) and hooked it into all database mutations ( ddTrackToPlaylist, emoveTrackFromPlaylist, etc.). usePlaylists subscribes to this bus, ensuring global reactivity across tabs.
  - Pre-warmed an isLiked memory cache inside the Context provider on mount by fetching all Liked Song IDs, allowing synchronous isLiked checks for rapid rendering of track lists.
  - Redesigned AddToPlaylistModal.tsx for optimistic UI toggles: users can tap checkboxes/hearts without closing the modal, and the UI responds instantly before DB writes complete.

## 26. Curated Icon Picker & Playlist Customization
- **The Upgrade:** Replaced the plain-text emoji input with a curated, scrollable horizontal grid of `Ionicons` (e.g., `musical-notes`, `headset`, `flame`, `star`) to better align with the app's aesthetic.
- **Implementation:** 
  - Created a v4 SQLite schema migration to add a `coverIcon` column.
  - Added self-healing fallback logic: existing playlists missing a `coverIcon` gracefully fall back to the `musical-notes` icon or their legacy `coverEmoji` text.
  - Re-wrote the Liked Songs initialization and repair scripts to strictly use the `heart` icon with a `#f7768e` background, enforcing consistency.
  - Expanded the cover art color palette to include Tokyo Night specific aesthetics (teal `#73daca`, cyan `#2ac3de`, purple `#9d7cd8`) and removed redundant, overly-dark background swatches that blended in.

## 27. Playlist Track Counts
- **The Upgrade:** Library view previously hardcoded "Playlist" as the subtitle for every playlist card, ignoring actual size.
- **The Fix:** Updated the `getPlaylists()` query to perform a `LEFT JOIN` on `playlist_tracks` with a `GROUP BY p.id`, accurately computing `COUNT(t.videoId) as trackCount`. The UI now displays accurate metrics (e.g. `12 songs`, `1 song`) directly off the highly performant database fetch.

## 28. Miniplayer Enhancements
- **The Upgrade:** The `NowPlayingBar` (miniplayer) previously timed out and auto-hid itself after 4 hours of inactivity.
- **The Fix:** Extended the inactivity `setTimeout` from 4 hours to **24 hours**, ensuring the miniplayer persists reliably across scattered listening sessions throughout the day.

## 29. PressableScale & Visual Polish
- **The Upgrade:** Replaced static `TouchableOpacity` usages across the app with a unified `PressableScale` component to add tactile, spring-based scaling animations (stiffness: 400, damping: 25) upon interaction, giving the app a premium, native feel.
- **Icon Standardization:** Enforced a solid-by-default icon policy across the app using `Ionicons`, reserving `-outline` variants solely for inactive toggle states. Standardized global icon sizing scales.
- **Gradient Refinements:** Added subtle `LinearGradient` effects behind Album and Playlist artwork. To maintain a tasteful UI, dynamic color backgrounds use a new HSL-based `darkenHex` utility to deeply dim cover colors rather than producing harsh neon backgrounds.
- **Playlist Customization Expansion:** Re-expanded the `COLORS` grid for playlist customization, providing 16 distinct options, deliberately resolving repeating cyan/purple values with highly contrasting swatches, and explicitly including pure black and the primary app theme color.

## 30. Visual Identity Revamp (Subtle Spider-Verse)
- **The Upgrade:** Shifted the app from a pure black/gray "Sunset" aesthetic to a rich, cinematic, Spider-Verse inspired dark mode.
- **The Changes:**
  - Introduced deep indigo foundations (`bg.page: #0B0B14`, `bg.surface: #151522`) replacing pure black.
  - Used crimson (`accent.primary: #E52B4D`) as the primary interactive accent, offset by cool blue and violet structural tones.
  - Rebuilt the `NowPlayingBar` (mini-player) and `PersistentTabBar` active states to feel like elevated floating surfaces with vivid active tints.
  - Added synchronized, global-state-aware circular Play/Pause floating action buttons to Album and Playlist screens.
  - Injected deeply blurred, low-opacity ambient artwork backgrounds behind the Player, Album, Playlist, and Home screens for a unified cinematic glow.
  - Refined global typography hierarchy, mapping all secondary metadata to a new cool blue-gray scale (`text.metadata: #8F9BB5`).

## 31. App Restart Playback Crash Fix
- **The Issue:** Tracks loaded via search or history saved their direct streaming URLs to the native TrackPlayer queue and SQLite database. These direct URLs contain expiration tokens (valid for ~24 hours). When reopening the app later, pressing Play would cause the player to crash while attempting to load the expired URL.
- **The Fix:** 
  - Updated `getPlaybackTrack` in `lib/api.ts` to strictly route all `streamUrl`s through the app's internal `/proxy/audio/` route, guaranteeing unexpired, on-demand resolution natively.
  - Added a sanitization layer in `hooks/usePlaybackState.ts` that intercepts legacy queues from SQLite on startup, overriding any old direct URLs with proxy URLs to instantly repair broken persistent sessions.

## 32. Native Queue Rebuild Fallback
- **The Upgrade:** When the app remains backgrounded for long periods, Android silently kills the background media service to reclaim memory, emptying the native queue while the JS UI remains visually intact.
- **The Fix:** Injected a robust safety layer directly into `lib/track-player.ts` (`togglePlayPause`, `skipToNext`, `skipToPrevious`). Whenever user interaction detects an empty native queue, it instantly reads the persisted playback session from the JavaScript memory and seamlessly reconstructs the full native queue behind the scenes, allowing playback to resume exactly where it was killed without any UI glitch.

## 33. Destructive UI Confirmation Dialogs
- **The Upgrade:** Destructive actions must not execute instantly on accidental taps.
- **The Fix:** Wrapped the playlist deletion function (`remove`) inside the `library.tsx` tab with a native `Alert.alert` confirmation dialog. Users are now explicitly prompted with "Are you sure you want to delete this playlist?" preventing accidental, irreversible destruction of custom playlists.
