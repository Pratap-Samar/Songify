import 'event-target-polyfill';
import { TransformStream } from 'web-streams-polyfill';
import 'text-encoding-polyfill';
import 'react-native-url-polyfill/auto';

// Ensure TransformStream is globally available for youtubei.js
if (typeof global.TransformStream === 'undefined') {
  (global as any).TransformStream = TransformStream;
}

// See https://github.com/nodejs/node/issues/40678#issuecomment-1126944677
class CustomEvent extends Event {
  #detail;

  constructor(type: string, options?: CustomEventInit<any[]>) {
    super(type, options);
    this.#detail = options?.detail ?? null;
  }

  get detail() {
    return this.#detail;
  }
}
(global as any).CustomEvent = CustomEvent as any;

import type { Innertube, Platform } from 'youtubei.js';

let _ytClientPromise: Promise<Innertube> | undefined;

export const preloadResolver = () => {
  getYtClient();
};

const getYtClient = () => {
  if (_ytClientPromise) return _ytClientPromise;
  
  const startInit = performance.now();
  _ytClientPromise = (async () => {
    try {
      const { Innertube, ClientType } = await import('youtubei.js');
      const importDone = performance.now();
      console.log(`[PlaybackPerf] youtubei.js module import: ${(importDone - startInit).toFixed(1)} ms`);
      
      const client = await Innertube.create({
        retrieve_player: false, // ZERO COST: IOS format returns pre-deciphered URLs
        enable_session_cache: false,
        generate_session_locally: false,
        client_type: ClientType.MWEB,
      });
      const createDone = performance.now();
      console.log(`[PlaybackPerf] Innertube.create(): ${(createDone - importDone).toFixed(1)} ms`);
      
      return client;
    } catch (error) {
      console.error(`[PlaybackPerf] Initialization failed:`, error);
      throw error;
    }
  })();
  
  return _ytClientPromise;
};

export type ResolvedStream = {
  url: string;
  loudnessDb?: number;
  mimeType?: string;
};

export type TrackMeta = {
  title: string;
  artist: string;
};

/**
 * Validates a standard YouTube video candidate against the original requested track.
 */
function isValidCandidate(candidate: any, meta: TrackMeta): boolean {
  if (!candidate || !candidate.title) return false;
  
  const candidateTitle = candidate.title.toString().toLowerCase();
  const reqTitle = meta.title.toLowerCase();
  const reqArtist = meta.artist.toLowerCase();

  // Basic rejection criteria for messy standard search results
  const isCover = candidateTitle.includes('cover');
  const isLive = candidateTitle.includes('live');
  const isNightcore = candidateTitle.includes('nightcore');
  const isRemix = candidateTitle.includes('remix');
  const isSlowed = candidateTitle.includes('slowed') || candidateTitle.includes('reverb');

  if (isCover || isLive || isNightcore || isSlowed) {
    // If the original track itself wasn't a cover/live/remix, reject it.
    if (!reqTitle.includes('cover') && isCover) return false;
    if (!reqTitle.includes('live') && isLive) return false;
    if (!reqTitle.includes('nightcore') && isNightcore) return false;
    if (!reqTitle.includes('remix') && isRemix) return false;
    if (!reqTitle.includes('slowed') && isSlowed) return false;
  }

  // A valid candidate should ideally match title and artist strings
  const titleMatches = candidateTitle.includes(reqTitle);
  const artistMatches = candidateTitle.includes(reqArtist) || 
                       (candidate.author && candidate.author.name && candidate.author.name.toLowerCase().includes(reqArtist));

  return titleMatches && artistMatches;
}

export const resolveYouTubeStream = async (
  videoId: string, 
  allowFallback = true, 
  trackMeta?: TrackMeta
): Promise<ResolvedStream> => {
  const startTotal = performance.now();
  const yt = await getYtClient();
  const initDone = performance.now();
  
  try {
    // 1. ORIGINAL VIDEO FIRST
    // Fetch using IOS client to get unblocked raw HTTP formats
    const extractedVideoInfo = await yt.getShortsVideoInfo(videoId, 'IOS');
    const fetchDone = performance.now();
    
    const maxAudioQualityStream = extractedVideoInfo.chooseFormat({
      quality: 'best',
      type: 'audio',
    });
    
    if (!maxAudioQualityStream || !maxAudioQualityStream.url) {
      throw new Error("Streaming data not available");
    }

    const url = maxAudioQualityStream.url;
    console.log(`[PlaybackPerf] Original resolution (${videoId}): ${(performance.now() - initDone).toFixed(1)} ms`);
    
    return {
      url,
      loudnessDb: maxAudioQualityStream.loudness_db,
      mimeType: maxAudioQualityStream.mime_type,
    };
  } catch (error: any) {
    // 2. TARGETED FALLBACK SEARCH (ONLY for Topic Tracks / Unplayable)
    const isUnplayable = error.message?.includes('Streaming data not available') || 
                         error.message?.includes('Video unavailable');
                         
    if (!isUnplayable || !allowFallback || !trackMeta) {
      console.log(`[YouTubeResolver] Falling back directly to Render for ${videoId}. Reason: ${error.message}`);
      throw new Error('Streaming data not available');
    }

    console.log(`[YouTubeResolver] Original resolution failed for ${videoId}. Attempting targeted fallback search...`);
    const searchStart = performance.now();
    
    const query = `${trackMeta.artist} ${trackMeta.title}`;
    const { searchTracksClientSide } = await import('./ytmusic');
    const searchResult = await searchTracksClientSide(query, 'videos');
    const rawCandidate = searchResult.videos?.[0];
    const candidate = rawCandidate ? { ...rawCandidate, id: rawCandidate.videoId } : undefined;
        if (!candidate || !isValidCandidate(candidate, trackMeta) || !candidate.id) {
        console.log(`[YouTubeResolver] Fallback candidate rejected for ${videoId}. Candidate: ${candidate?.title}`);
        throw new Error('Streaming data not available');
      }

    console.log(`[YouTubeResolver] Fallback candidate accepted: ${candidate.id} (${candidate.title})`);
    console.log(`[PlaybackPerf] Fallback search: ${(performance.now() - searchStart).toFixed(1)} ms`);
    
    // 3. RESOLVE CANDIDATE (Prevent recursion)
      try {
        return await resolveYouTubeStream(candidate.id, false);
      } catch (candidateError) {
        console.log(`[YouTubeResolver] Candidate resolution failed for ${videoId}`);
        throw new Error('Streaming data not available');
      }
  }
};
