import TrackPlayer, { Event } from '@javascriptcommon/react-native-track-player';
import { clearPlaybackSession } from './lib/playback-session';

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.reset();
    clearPlaybackSession();
  });
};
