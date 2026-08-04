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

export interface AlbumSearchItem {
  id: string;
  title: string;
  artists: string[];
  thumbnailUrl: string | null;
  year?: string | null;
}

export interface Album {
  id: string;
  title: string;
  artists: string[];
  artwork: string | null;
  year?: string | null;
  description?: string | null;
  trackCount?: number | null;
  duration?: string | null;
  tracks: Track[];
}

export interface Collection {
  id: string;
  title: string;
  artwork?: string | null;
  tracks: Track[];
  type: "album" | "playlist" | "downloads" | "liked" | "search";
}
