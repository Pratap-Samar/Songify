export type Track = {
  videoId: string;
  title: string;
  artists: string[];
  album: string | null;
  durationMs: number | null;
  thumbnailUrl: string | null;
};

export type PlaybackTrack = Track & {
  streamUrl: string;
  mimeType: string;
  expiresInSeconds: number | null;
};
