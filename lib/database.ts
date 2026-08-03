import type { Track } from "./music";
import { notifyHistoryChanged } from "./historyEvents";

export interface Playlist {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistTrack {
  playlistId: number;
  videoId: string;
  title: string;
  artists: string;
  album: string | null;
  durationMs: number | null;
  thumbnailUrl: string | null;
  position: number;
}

type SQLiteModule = {
  openDatabaseSync: (name: string) => {
    execAsync: (sql: string) => Promise<void>;
    getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
    runAsync: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowId: number }>;
  };
};

let db: ReturnType<SQLiteModule["openDatabaseSync"]> | null = null;

function getDb() {
  if (db) return db;
  try {
    const SQLite = require("expo-sqlite") as SQLiteModule;
    db = SQLite.openDatabaseSync("songify.db");
  } catch {
    db = null;
  }
  return db;
}

export async function initDb() {
  const database = getDb();
  if (!database) return;
  console.log("[Database] Running initDb()...");
  await database.execAsync(
    `CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      artwork TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlistId INTEGER NOT NULL,
      videoId TEXT NOT NULL,
      title TEXT NOT NULL,
      artists TEXT NOT NULL,
      album TEXT,
      durationMs INTEGER,
      thumbnailUrl TEXT,
      position INTEGER NOT NULL,
      FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
      PRIMARY KEY (playlistId, videoId)
    );
    CREATE TABLE IF NOT EXISTS recent_plays (
      videoId TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artists TEXT NOT NULL,
      album TEXT,
      durationMs INTEGER,
      thumbnailUrl TEXT,
      lastPlayedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );`
  );
  

  
  console.log("[Database] initDb() completed successfully.");
}

export async function getPlaylists(): Promise<Playlist[]> {
  const database = getDb();
  if (!database) return [];
  return database.getAllAsync<Playlist>(
    "SELECT id, name, createdAt, updatedAt FROM playlists ORDER BY updatedAt DESC;"
  );
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const database = getDb();
  if (!database) throw new Error("Database is not available on this platform.");
  const result = await database.runAsync("INSERT INTO playlists (name) VALUES (?);", [name]);
  const id = result.lastInsertRowId as unknown as number;
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync(
    "UPDATE playlists SET name = ?, updatedAt = datetime('now') WHERE id = ?;",
    [name, id]
  );
}

export async function deletePlaylist(id: number): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync("DELETE FROM playlists WHERE id = ?;", [id]);
}

export async function getPlaylistTracks(
  playlistId: number
): Promise<PlaylistTrack[]> {
  const database = getDb();
  if (!database) return [];
  return database.getAllAsync<PlaylistTrack>(
    "SELECT playlistId, videoId, title, artists, album, durationMs, thumbnailUrl, position FROM playlist_tracks WHERE playlistId = ? ORDER BY position ASC;",
    [playlistId]
  );
}

export async function addTrackToPlaylist(
  playlistId: number,
  track: Track
): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync(
    "INSERT OR IGNORE INTO playlist_tracks (playlistId, videoId, title, artists, album, durationMs, thumbnailUrl, position) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_tracks WHERE playlistId = ?));",
    [
      playlistId,
      track.videoId,
      track.title,
      JSON.stringify(track.artists),
      typeof track.album === "object" && track.album !== null ? (track.album as any).name || JSON.stringify(track.album) : (track.album ?? ""),
      track.durationMs ?? 0,
      track.thumbnailUrl ?? "",
      playlistId,
    ]
  );
}

export async function removeTrackFromPlaylist(
  playlistId: number,
  videoId: string
): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync(
    "DELETE FROM playlist_tracks WHERE playlistId = ? AND videoId = ?;",
    [playlistId, videoId]
  );
}

export async function reorderPlaylistTrack(
  playlistId: number,
  videoId: string,
  newPosition: number
): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync(
    "UPDATE playlist_tracks SET position = ?, updatedAt = datetime('now') WHERE playlistId = ? AND videoId = ?;",
    [newPosition, playlistId, videoId]
  );
}



export async function addToHistory(track: Track): Promise<void> {
  const database = getDb();
  if (!database) return;
  const params = [
    track.videoId,
    track.title,
    JSON.stringify(track.artists),
    typeof track.album === "object" && track.album !== null ? (track.album as any).name || JSON.stringify(track.album) : (track.album ?? ""),
    track.durationMs ?? 0,
    track.thumbnailUrl ?? "",
  ];
  
  await database.runAsync(
    `INSERT INTO recent_plays (videoId, title, artists, album, durationMs, thumbnailUrl, lastPlayedAt)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(videoId) DO UPDATE SET lastPlayedAt = datetime('now');`,
    ...params
  );
  console.log(`[Database] addToHistory: Completed for "${track.title}". Notifying listeners.`);
  notifyHistoryChanged();
}

export async function getHistory(limit = 20): Promise<Track[]> {
  const database = getDb();
  if (!database) return [];
  console.log(`[Database] getHistory: Fetching top ${limit} recent_plays...`);
  const rows = await database.getAllAsync<any>(
    "SELECT videoId, title, artists, album, durationMs, thumbnailUrl FROM recent_plays ORDER BY lastPlayedAt DESC LIMIT ?;",
    [limit]
  );
  console.log(`[Database] getHistory: Found ${rows.length} rows.`);
  return rows.map((r) => ({
    videoId: r.videoId,
    title: r.title,
    artists: JSON.parse(r.artists),
    album: r.album,
    durationMs: r.durationMs,
    thumbnailUrl: r.thumbnailUrl,
  }));
}