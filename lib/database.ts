import type { SQLiteDatabase } from "expo-sqlite";
import type { Track } from "./music";
import type { PlaybackSession } from "./playback-session";
import { logger } from "./logger";
import { notifyHistoryChanged } from "./historyEvents";

export interface SavedAlbum {
  id: string;
  title: string;
  artists: string;
  thumbnailUrl: string | null;
  year: string | null;
  savedAt: string;
}

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
  openDatabaseSync: (name: string) => SQLiteDatabase;
};

let db: ReturnType<SQLiteModule["openDatabaseSync"]> | null = null;
let initDbPromise: Promise<void> | null = null;

// HACK: Force re-initialization on hot reload to guarantee migrations run
db = null;
initDbPromise = null;

function getDb() {
  if (db) return db;
  try {
    const SQLite = require("expo-sqlite") as SQLiteModule;
    // Log the actual filesystem path so we know which DB file is being opened.
    const dbName = "songify.db";
    console.log(`[DB] Opening database: ${dbName}`);
    db = SQLite.openDatabaseSync(dbName);
    console.log(`[DB] Database opened successfully.`);
  } catch (e) {
    console.error("[DB] Failed to open database:", e);
    db = null;
  }
  return db;
}


export async function initDb() {
  if (initDbPromise) return initDbPromise;
  initDbPromise = (async () => {
    const database = getDb();
    if (!database) {
      console.error("[DB] initDb: getDb() returned null — cannot initialise.");
      return;
    }

    // ── Step 1: Read current schema version ─────────────────────────────────
    const versionRow = await database.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version;"
    );
    const currentVersion = versionRow?.user_version ?? 0;
    console.log(`[DB] PRAGMA user_version = ${currentVersion} (before migration)`);

    // ── Step 2: Create base tables (safe on any DB at any version) ──────────
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
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
        PRIMARY KEY (playlistId, videoId),
        FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS recent_plays (
        videoId TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artists TEXT NOT NULL,
        album TEXT,
        durationMs INTEGER,
        thumbnailUrl TEXT,
        lastPlayedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS playback_session (
        id INTEGER PRIMARY KEY,
        source TEXT,
        collectionId TEXT,
        collectionTitle TEXT,
        queue TEXT,
        queueIndex INTEGER,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS saved_albums (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artists TEXT NOT NULL,
        thumbnailUrl TEXT,
        year TEXT,
        savedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // ── Helper: dump PRAGMA table_info for a table ───────────────────────────
    const logTableInfo = async (table: string, label: string) => {
      try {
        const cols = await database.getAllAsync<{
          cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
        }>(`PRAGMA table_info(${table});`);
        console.log(
          `[DB] PRAGMA table_info(${table}) [${label}]:`,
          cols.map((c) => `${c.cid}:${c.name}(${c.type})`).join(" | ")
        );
      } catch (e) {
        console.error(`[DB] Failed to read table_info(${table}) [${label}]:`, e);
      }
    };

    // ── Helper: run one ALTER TABLE, log the SQL, log success or full error ──
    const alterCol = async (sql: string) => {
      console.log(`[DB] ALTER → ${sql}`);
      try {
        await database.execAsync(sql);
        console.log(`[DB] ALTER OK: ${sql}`);
      } catch (e: any) {
        // "duplicate column name" is expected on fresh installs — log but don't throw.
        const msg: string = e?.message ?? String(e);
        if (msg.toLowerCase().includes("duplicate column")) {
          console.log(`[DB] ALTER skipped (column exists): ${sql}`);
        } else {
          console.error(`[DB] ALTER FAILED: ${sql} →`, msg);
        }
      }
    };

    // ── Step 3: Version-gated migrations ────────────────────────────────────
    if (currentVersion < 2) {
      console.log("[DB] Migration to v2 START");

      await alterCol("ALTER TABLE recent_plays ADD COLUMN thumbnailUrl TEXT;");
      await alterCol("ALTER TABLE recent_plays ADD COLUMN durationMs INTEGER;");
      await alterCol("ALTER TABLE recent_plays ADD COLUMN album TEXT;");
      await alterCol("ALTER TABLE playlist_tracks ADD COLUMN thumbnailUrl TEXT;");
      await alterCol("ALTER TABLE saved_albums ADD COLUMN thumbnailUrl TEXT;");
      await alterCol("ALTER TABLE saved_albums ADD COLUMN year TEXT;");

      await database.execAsync("PRAGMA user_version = 2;");
      const verifyRow = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
      console.log(`[DB] Migration 2 DONE — user_version now = ${verifyRow?.user_version}`);
    } else {
      console.log(`[DB] Migration 2 SKIPPED (user_version = ${currentVersion})`);
    }

    console.log("[DB] initDb complete.");
  })();

  // If initDb fails, clear the cached promise so the next call retries.
  initDbPromise!.catch((e) => {
    console.error("[DB] initDb FAILED:", e);
    initDbPromise = null;
  });

  return initDbPromise;
}


// ── Playlists ───────────────────────────────────────────────────────────────

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
    "UPDATE playlist_tracks SET position = ? WHERE playlistId = ? AND videoId = ?;",
    [newPosition, playlistId, videoId]
  );
}

// ── History ─────────────────────────────────────────────────────────────────

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
  logger.debug(`[Database] addToHistory: Completed for "${track.title}". Notifying listeners.`);
  notifyHistoryChanged();
}

export async function getHistory(limit = 20): Promise<Track[]> {
  const database = getDb();
  if (!database) return [];
  logger.debug(`[Database] getHistory: Fetching top ${limit} recent_plays...`);
  const rows = await database.getAllAsync<any>(
    "SELECT videoId, title, artists, album, durationMs, thumbnailUrl FROM recent_plays ORDER BY lastPlayedAt DESC LIMIT ?;",
    [limit]
  );
  logger.debug(`[Database] getHistory: Found ${rows.length} rows.`);
  return rows.map((r) => ({
    videoId: r.videoId,
    title: r.title,
    artists: JSON.parse(r.artists),
    album: r.album,
    durationMs: r.durationMs,
    thumbnailUrl: r.thumbnailUrl,
  }));
}

export async function savePlaybackSession(session: PlaybackSession): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync(
    `INSERT INTO playback_session (id, source, collectionId, collectionTitle, queue, queueIndex, updatedAt)
     VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       source = excluded.source,
       collectionId = excluded.collectionId,
       collectionTitle = excluded.collectionTitle,
       queue = excluded.queue,
       queueIndex = excluded.queueIndex,
       updatedAt = datetime('now');`,
    [
      session.source,
      session.collectionId ?? "",
      session.collectionTitle ?? "",
      JSON.stringify(session.queue),
      session.currentIndex,
    ]
  );
}

export async function clearPlaybackSession(): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync("DELETE FROM playback_session WHERE id = 1;");
}

export async function getSavedPlaybackSession(): Promise<PlaybackSession | null> {
  const database = getDb();
  if (!database) return null;
  try {
    const row = await database.getFirstAsync<{
      source: string;
      collectionId: string;
      collectionTitle: string;
      queue: string;
      queueIndex: number;
    }>(
      `SELECT source, collectionId, collectionTitle, queue, queueIndex FROM playback_session WHERE id = 1;`
    );
    if (!row) return null;
    const session: PlaybackSession = {
      source: row.source as any,
      collectionId: row.collectionId || null,
      collectionTitle: row.collectionTitle || null,
      queue: JSON.parse(row.queue),
      currentIndex: row.queueIndex,
    };
    return session;
  } catch (err) {
    console.error("[Database] Failed to retrieve saved playback session:", err);
    return null;
  }
}

// ── Saved Albums ────────────────────────────────────────────────────────────

export async function addAlbum(
  id: string,
  title: string,
  artists: string[],
  thumbnailUrl: string | null,
  year: string | null
): Promise<void> {
  const database = getDb();
  if (!database) return;

  // ── Runtime proof: log the actual columns in saved_albums before INSERT ──
  try {
    const cols = await database.getAllAsync<{ cid: number; name: string; type: string }>(
      "PRAGMA table_info(saved_albums);"
    );
    console.log(
      "[DB] addAlbum — PRAGMA table_info(saved_albums) immediately before INSERT:",
      cols.map((c) => `${c.cid}:${c.name}(${c.type})`).join(" | ")
    );
  } catch (e) {
    console.error("[DB] addAlbum — failed to read table_info(saved_albums):", e);
  }

  await database.runAsync(
    `INSERT INTO saved_albums (id, title, artists, thumbnailUrl, year, savedAt)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO NOTHING;`,
    id,
    title,
    JSON.stringify(artists),
    thumbnailUrl ?? null,
    year ?? null
  );
  console.log(`[DB] addAlbum: saved "${title}" (id=${id})`);
}

export async function getAlbums(): Promise<SavedAlbum[]> {
  const database = getDb();
  if (!database) return [];
  const rows = await database.getAllAsync<SavedAlbum>(
    `SELECT id, title, artists, thumbnailUrl, year, savedAt FROM saved_albums ORDER BY savedAt DESC;`
  );
  return rows;
}

export async function isAlbumSaved(id: string): Promise<boolean> {
  const database = getDb();
  if (!database) return false;
  const row = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM saved_albums WHERE id = ?;`,
    id
  );
  return row !== null;
}

export async function removeAlbum(id: string): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.runAsync(`DELETE FROM saved_albums WHERE id = ?;`, id);
  logger.debug(`[Database] removeAlbum: removed album ${id}`);
}
