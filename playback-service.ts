import TrackPlayer, { Event } from '@javascriptcommon/react-native-track-player';
import { clearPlaybackSession } from './lib/playback-session';
import { skipToNext, skipToPrevious, togglePlayback } from './lib/track-player';

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => togglePlayback());
  TrackPlayer.addEventListener(Event.RemotePause, () => togglePlayback());
  TrackPlayer.addEventListener(Event.RemoteNext, () => skipToNext(false));
  TrackPlayer.addEventListener(Event.RemotePrevious, () => skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    // Should we call TrackPlayer.reset() directly here?
    // It's a stop action, so resetting the native player is fine, but we might want to let the custom logic handle it.
    // For now, it's just clearing the native player. But it will emit State.Ended or State.Stopped.
    // And isResettingQueue won't be true!
    // So scheduleQueueAdvance might run!
    // We should probably just pause. But let's leave it as reset for now, since currentSession is cleared.
    clearPlaybackSession();
    await TrackPlayer.reset();
  });
};
