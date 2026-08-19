import { Track, AlbumSearchItem } from "./music";
import { SearchResponse } from "./api";

const CLIENT_NAME = "WEB_REMIX";
const CLIENT_VERSION = "1.20230522.01.00";
const YTM_BASE_URL = "https://music.youtube.com/youtubei/v1/search";

async function fetchInnerTubeSearch(query: string, params?: string) {
  const response = await fetch(YTM_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "origin": "https://music.youtube.com",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: CLIENT_NAME,
          clientVersion: CLIENT_VERSION,
          hl: "en",
          gl: "US",
        },
      },
      query,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`InnerTube search failed with status ${response.status}`);
  }

  return response.json();
}

function parseDurationMs(durationStr: string | null): number | null {
  if (!durationStr) return null;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

function parseSearchResults(data: any, type: "songs" | "albums" | "videos"): any[] {
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
  const tab = tabs.find((t: any) => t.tabRenderer?.content)?.tabRenderer?.content;
  if (!tab) return [];

  const sectionList = tab.sectionListRenderer?.contents || [];
  let items: any[] = [];
  for (const section of sectionList) {
    if (section.musicShelfRenderer) {
      items = items.concat(section.musicShelfRenderer.contents || []);
    } else if (section.itemSectionRenderer) {
      items = items.concat(section.itemSectionRenderer.contents || []);
    }
  }

  const results: any[] = [];
  for (const item of items) {
    const renderer = item.musicResponsiveListItemRenderer;
    if (!renderer) continue;

    const flexColumns = renderer.flexColumns || [];
    const id = renderer.playlistItemData?.videoId;
    const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
    const watchEndpoint = renderer.navigationEndpoint?.watchEndpoint;
    const finalVideoId = id || watchEndpoint?.videoId;

    let title = "";
    let artists: string[] = [];
    let album: string | null = null;
    let durationMs: number | null = null;
    let year: string | null = null;

    if (flexColumns.length > 0) {
      const titleRuns = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      title = titleRuns.map((r: any) => r.text).join("");
    }

    if (flexColumns.length > 1) {
      const runs = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const textParts = runs.map((r: any) => r.text).join('').split(' \u2022 ');

      if (type === "songs" || type === "videos") {
        if (textParts.length > 0) {
          artists = textParts[0].split(/ & |, | and /).map((a: string) => a.trim()).filter(Boolean);
        }
        if (type === "songs" && textParts.length > 2) {
          album = textParts[1].trim();
        }
        const durationPart = textParts[textParts.length - 1];
        if (durationPart && durationPart.match(/^\d+:/)) {
          durationMs = parseDurationMs(durationPart.trim());
        }
      } else if (type === "albums") {
        let artistPartIndex = 0;
        if (["Album", "EP", "Single"].includes(textParts[0])) {
          artistPartIndex = 1;
        }
        if (textParts.length > artistPartIndex) {
          artists = textParts[artistPartIndex].split(/ & |, | and /).map((a: string) => a.trim()).filter(Boolean);
        }
        if (textParts.length > artistPartIndex + 1) {
          year = textParts[artistPartIndex + 1].trim();
        }
      }
    }

    const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    const thumbnailUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;

    if (type === "songs" || type === "videos") {
      if (!finalVideoId) continue;
      results.push({
        videoId: finalVideoId,
        title,
        artists: artists.length > 0 ? artists : ["Unknown Artist"],
        album,
        durationMs,
        thumbnailUrl
      });
    } else if (type === "albums") {
      if (!browseId) continue;
      results.push({
        id: browseId,
        title,
        artists: artists.length > 0 ? artists : ["Unknown Artist"],
        year,
        thumbnailUrl
      });
    }
  }

  return results;
}

export async function searchTracksClientSide(
  query: string,
  type?: "songs" | "albums" | "videos"
): Promise<SearchResponse> {
  let songs: Track[] = [];
  let albums: AlbumSearchItem[] = [];
  let videos: Track[] = [];

  try {
    if (!type || type === "songs") {
      const data = await fetchInnerTubeSearch(query, "EgWKAQIIAWoMEAMQBBAJEA4QChAF");
      songs = parseSearchResults(data, "songs") as Track[];
    }
    if (!type || type === "albums") {
      const data = await fetchInnerTubeSearch(query, "EgWKAQIYAWoMEAMQBBAJEA4QChAF");
      albums = parseSearchResults(data, "albums") as AlbumSearchItem[];
    }
    if (!type || type === "videos") {
      const data = await fetchInnerTubeSearch(query, "EgWKAQIQAWoMEAMQBBAJEA4QChAF");
      videos = parseSearchResults(data, "videos") as Track[];
    }
  } catch (error) {
    throw error;
  }

  return { songs, albums, videos };
}

export async function getTrackClientSide(videoId: string): Promise<Track> {
  const response = await fetch("https://music.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "origin": "https://music.youtube.com",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: CLIENT_NAME,
          clientVersion: CLIENT_VERSION,
          hl: "en",
          gl: "US",
        },
      },
      videoId,
    }),
  });

  if (!response.ok) {
    throw new Error(`InnerTube player failed with status ${response.status}`);
  }

  const data = await response.json();
  const videoDetails = data?.videoDetails;
  if (!videoDetails) {
    throw new Error("Track not found or videoDetails missing");
  }

  const title = videoDetails.title || "";
  const author = videoDetails.author || "Unknown Artist";
  const durationSeconds = parseInt(videoDetails.lengthSeconds || "0", 10);
  const durationMs = durationSeconds ? durationSeconds * 1000 : null;
  const thumbnails = videoDetails.thumbnail?.thumbnails || [];
  const thumbnailUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;

  return {
    videoId,
    title,
    artists: [author],
    album: null,
    durationMs,
    thumbnailUrl,
  };
}

export async function getAlbumClientSide(browseId: string): Promise<import("./music").Album> {
  const response = await fetch("https://music.youtube.com/youtubei/v1/browse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "origin": "https://music.youtube.com",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: CLIENT_NAME,
          clientVersion: CLIENT_VERSION,
          hl: "en",
          gl: "US",
        },
      },
      browseId,
    }),
  });

  if (!response.ok) {
    throw new Error(`InnerTube browse failed with status ${response.status}`);
  }

  const data = await response.json();
  
  let title = "";
  let artists: string[] = ["Unknown Artist"];
  let year: string | null = null;
  let artwork: string | null = null;
  let description: string | null = null;

  const header = data?.header?.musicDetailHeaderRenderer || data?.header?.musicImmersiveHeaderRenderer;
  if (header) {
    title = header.title?.runs?.map((r: any) => r.text).join("") || "";
    const subtitleParts = header.subtitle?.runs?.map((r: any) => r.text).join("").split(" \u2022 ") || [];
    if (subtitleParts.length >= 2) {
      artists = subtitleParts[1].split(/ & |, | and /).map((a: string) => a.trim()).filter(Boolean);
    }
    if (subtitleParts.length >= 3) {
      year = subtitleParts[2].trim();
    }
    const thumbnails = header.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails 
      || header.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    artwork = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;
    description = header.description?.runs?.map((r: any) => r.text).join("") || null;
  } else if (data?.microformat?.microformatDataRenderer) {
    const mf = data.microformat.microformatDataRenderer;
    title = mf.title || "";
    description = mf.description || null;
    
    if (description) {
      const parts = description.split(" \u2022 ");
      if (parts.length >= 2) {
        artists = parts[1].split(/ & |, | and /).map((a: string) => a.trim()).filter(Boolean);
      }
      if (parts.length >= 3) {
        year = parts[2].trim();
      }
    }
    
    const thumbnails = mf.thumbnail?.thumbnails || [];
    artwork = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;
  } else {
    throw new Error("Album metadata not found (no header or microformat)");
  }
  
  let sectionList: any[] = [];
  const twoColumn = data?.contents?.twoColumnBrowseResultsRenderer;
  if (twoColumn?.secondaryContents?.sectionListRenderer?.contents) {
    sectionList = twoColumn.secondaryContents.sectionListRenderer.contents;
  } else {
    const tabs = twoColumn?.tabs || data?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
    const tab = tabs.find((t: any) => t.tabRenderer?.content)?.tabRenderer?.content;
    sectionList = tab?.sectionListRenderer?.contents || [];
  }
  
  let musicShelf = null;
  for (const section of sectionList) {
    if (section.musicShelfRenderer) {
      musicShelf = section.musicShelfRenderer;
      break;
    }
  }
  
  const contents = musicShelf?.contents || [];
  const tracks: Track[] = [];
  
  for (const item of contents) {
    const renderer = item.musicResponsiveListItemRenderer;
    if (!renderer) continue;
    
    const flexColumns = renderer.flexColumns || [];
    const id = renderer.playlistItemData?.videoId;
    if (!id) continue;
    
    let trackTitle = "";
    if (flexColumns.length > 0) {
      const runs = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      trackTitle = runs.map((r: any) => r.text).join("");
    }
    
    let trackArtists = artists;
    let durationMs: number | null = null;
    
    if (flexColumns.length > 1) {
      const runs = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const parts = runs.map((r: any) => r.text).filter((t: string) => t !== " \u2022 " && t !== "");
      if (parts.length > 0) {
        const artistParts = parts.filter((p: string) => !p.match(/^\d+:/));
        if (artistParts.length > 0) {
          trackArtists = artistParts.join("").split(/ & |, | and /).map((a: string) => a.trim());
        }
        
        const durationPart = parts.find((p: string) => p.match(/^\d+:/));
        if (durationPart) {
          durationMs = parseDurationMs(durationPart);
        }
      }
    }
    
    const fixedColumns = renderer.fixedColumns || [];
    if (fixedColumns.length > 0 && !durationMs) {
      const runs = fixedColumns[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs || [];
      const durationPart = runs.map((r: any) => r.text).join("").trim();
      if (durationPart.match(/^\d+:/)) {
        durationMs = parseDurationMs(durationPart);
      }
    }
    
    tracks.push({
      videoId: id,
      title: trackTitle,
      artists: trackArtists,
      album: title,
      durationMs,
      thumbnailUrl: artwork
    });
  }
  
  return {
    id: browseId,
    title,
    artists,
    artwork,
    year,
    description,
    tracks,
    trackCount: tracks.length,
  };
}
