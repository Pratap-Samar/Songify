import type { SQLiteDatabase } from "expo-sqlite";
import type { Track } from "./music";
import type { PlaybackSession } from "./playback-session";
import type { AlbumSearchItem } from "./music";
import { logger } from "./logger";
import { getPlaybackTrack } from "./api";
import { notifyHistoryChanged } from "./historyEvents";
import { notifyPlaylistsChanged } from "./playlistEvents";
import { notifyAlbumsChanged } from "./albumEvents";

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
  isSystem: number;
  coverEmoji?: string | null;
  coverIcon?: string | null;
  coverColor?: string | null;
  createdAt: string;
  updatedAt: string;
  trackCount?: number;
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

function getDbSync() {
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

export async function getDbAsync() {
  await initDb();
  return getDbSync();
}

async function cleanupDuplicateLikedSongs(database: SQLiteDatabase) {
  const duplicates = await database.getAllAsync<{ id: number }>(
    "SELECT id FROM playlists WHERE isSystem = 1 AND name = 'Liked Songs' ORDER BY id ASC;"
  );

  if (duplicates.length > 1) {
    const keepId = duplicates[0].id;
    const deleteIds = duplicates.slice(1).map(d => d.id);
    console.log(`[DB] CRITICAL: Found ${duplicates.length} duplicate 'Liked Songs' playlists.`);
    console.log(`[DB] Keeping ID ${keepId}, deleting ${deleteIds.join(', ')}`);

    for (const dupId of deleteIds) {
      // 1. Fetch tracks in duplicate to log them before destructive merge
      const tracksInDup = await database.getAllAsync<{ videoId: string, title: string }>(
        "SELECT videoId, title FROM playlist_tracks WHERE playlistId = ?;",
        [dupId]
      );
      
      const tracksInKeep = await database.getAllAsync<{ videoId: string }>(
        "SELECT videoId FROM playlist_tracks WHERE playlistId = ?;",
        [keepId]
      );
      const keepTrackIds = new Set(tracksInKeep.map(t => t.videoId));
      
      let migrated = 0;
      let dropped = 0;
      
      console.log(`[DB] Duplicate ID ${dupId} has ${tracksInDup.length} tracks.`);
      
      for (const track of tracksInDup) {
        if (keepTrackIds.has(track.videoId)) {
          dropped++;
        } else {
          migrated++;
        }
      }
      console.log(`[DB] Merging ID ${dupId} into ID ${keepId}: ${migrated} tracks migrated, ${dropped} tracks dropped (already existed in kept playlist).`);

      // 2. Perform the merge safely (INSERT OR IGNORE essentially)
      // Since it's a primary key (playlistId, videoId), UPDATE OR IGNORE will silently ignore collisions.
      await database.runAsync(
        "UPDATE OR IGNORE playlist_tracks SET playlistId = ? WHERE playlistId = ?;",
        [keepId, dupId]
      );

      // 3. Delete the duplicate playlist (cascade deletes any un-migrated colliding tracks)
      await database.runAsync("DELETE FROM playlists WHERE id = ?;", [dupId]);
    }
  }
}



export async function initDb() {
  if (initDbPromise) return initDbPromise;
  initDbPromise = (async () => {
    const database = getDbSync();
    if (!database) {
      console.error("[DB] initDb: getDbSync() returned null — cannot initialise.");
      return;
    }

    // ── Step 0: Set PRAGMAs (Critical for concurrency) ──────────────────────
    let retries = 10;
    while (retries > 0) {
      try {
        await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
        break; // Success
      } catch (e: any) {
        if (e.message && e.message.includes("database is locked")) {
          retries--;
          if (retries === 0) {
            throw new Error(`[DB] EXHAUSTED retries waiting for database lock during PRAGMA init. Underlying error: ${e.message}`);
          }
          console.log(`[DB] PRAGMA locked, retrying... (${retries} attempts left)`);
          const delay = 200 + Math.random() * 150;
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw e; // Non-lock error, bubble up immediately
        }
      }
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
        isSystem INTEGER DEFAULT 0,
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

    // Ensure system playlists are unique by name to prevent race conditions during auto-creation
    try {
      await database.execAsync("CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_system_name ON playlists(name) WHERE isSystem = 1;");
      console.log("[DB] Ensured unique index on system playlists.");
    } catch (e) {
      console.error("[DB] Failed to create unique index on system playlists:", e);
    }

    // ── Safe dynamic column additions (independent of version) ──────────────
    const playlistsCols = await database.getAllAsync<{ name: string }>("PRAGMA table_info(playlists);");
    if (!playlistsCols.some((col) => col.name === "isSystem")) {
      console.log("[DB] Adding missing isSystem column to playlists table...");
      try {
        await database.execAsync("ALTER TABLE playlists ADD COLUMN isSystem INTEGER DEFAULT 0;");
        console.log("[DB] Added isSystem column successfully.");
      } catch (e: any) {
        console.error("[DB] Failed to add isSystem column:", e?.message ?? e);
      }
    }

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

    if (currentVersion < 3) {
      console.log("[DB] Migration to v3 START");

      await alterCol("ALTER TABLE playlists ADD COLUMN coverEmoji TEXT;");
      await alterCol("ALTER TABLE playlists ADD COLUMN coverColor TEXT;");

      // Update Liked Songs system playlist to have the heart emoji and color
      await alterCol("UPDATE playlists SET coverEmoji = '❤️', coverColor = '#f7768e' WHERE isSystem = 1;");

      await database.execAsync("PRAGMA user_version = 3;");
      const verifyRow = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
      console.log(`[DB] Migration 3 DONE — user_version now = ${verifyRow?.user_version}`);
    } else {
      console.log(`[DB] Migration 3 SKIPPED (user_version = ${currentVersion})`);
    }

    if (currentVersion < 4) {
      console.log("[DB] Migration to v4 START");

      await alterCol("ALTER TABLE playlists ADD COLUMN coverIcon TEXT;");

      // Update Liked Songs system playlist to have the heart icon
      await alterCol("UPDATE playlists SET coverIcon = 'heart', coverColor = '#f7768e' WHERE isSystem = 1;");

      await database.execAsync("PRAGMA user_version = 4;");
      const verifyRow = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
      console.log(`[DB] Migration 4 DONE — user_version now = ${verifyRow?.user_version}`);
    } else {
      console.log(`[DB] Migration 4 SKIPPED (user_version = ${currentVersion})`);
    }

    // Run one-time cleanup for any duplicate "Liked Songs" playlists caused by prior race conditions
    await cleanupDuplicateLikedSongs(database);

    // Repair Liked Songs missing art (in case it was created after migration 4)
    try {
      await database.execAsync("UPDATE playlists SET coverIcon = 'heart', coverColor = '#f7768e' WHERE isSystem = 1 AND coverIcon IS NULL;");
    } catch (e) {
      console.error("[DB] Failed to repair Liked Songs art:", e);
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
  const database = await getDbAsync();
  if (!database) return [];
  return database.getAllAsync<Playlist>(
    `SELECT p.id, p.name, p.isSystem, p.coverEmoji, p.coverIcon, p.coverColor, p.createdAt, p.updatedAt, COUNT(t.videoId) as trackCount
     FROM playlists p
     LEFT JOIN playlist_tracks t ON p.id = t.playlistId
     GROUP BY p.id
     ORDER BY p.updatedAt DESC;`
  );
}

export async function createPlaylist(name: string, isSystem = 0, coverIcon: string | null = null, coverColor: string | null = null): Promise<Playlist> {
  const database = await getDbAsync();
  if (!database) throw new Error("Database is not available on this platform.");
  const result = await database.runAsync(
    "INSERT INTO playlists (name, isSystem, coverIcon, coverColor) VALUES (?, ?, ?, ?);", 
    [name, isSystem, coverIcon, coverColor]
  );
  const id = result.lastInsertRowId as unknown as number;
  notifyPlaylistsChanged();
  return {
    id,
    name,
    isSystem,
    coverIcon,
    coverColor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trackCount: 0,
  };
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  const database = await getDbAsync();
  if (!database) return;
  const row = await database.getFirstAsync<{ isSystem: number }>(
    "SELECT isSystem FROM playlists WHERE id = ?;",
    [id]
  );
  if (row?.isSystem === 1) {
    console.warn(`[DB] Attempted to rename system playlist ${id}. Ignoring.`);
    return;
  }
  await database.runAsync(
    "UPDATE playlists SET name = ?, updatedAt = datetime('now') WHERE id = ?;",
    [name, id]
  );
  notifyPlaylistsChanged();
}

export async function updatePlaylistArt(id: number, coverIcon: string | null, coverColor: string | null): Promise<void> {
  const database = await getDbAsync();
  if (!database) return;
  await database.runAsync(
    "UPDATE playlists SET coverIcon = ?, coverColor = ?, updatedAt = datetime('now') WHERE id = ?;",
    [coverIcon, coverColor, id]
  );
  notifyPlaylistsChanged();
}

export async function deletePlaylist(id: number): Promise<void> {
  const database = await getDbAsync();
  if (!database) return;
  const row = await database.getFirstAsync<{ isSystem: number }>(
    "SELECT isSystem FROM playlists WHERE id = ?;",
    [id]
  );
  if (row?.isSystem === 1) {
    console.warn(`[DB] Attempted to delete system playlist ${id}. Ignoring.`);
    return;
  }
  await database.runAsync("DELETE FROM playlists WHERE id = ?;", [id]);
  notifyPlaylistsChanged();
}

export async function getPlaylistTracks(
  playlistId: number
): Promise<PlaylistTrack[]> {
  const database = await getDbAsync();
  if (!database) return [];
  return database.getAllAsync<PlaylistTrack>(
    "SELECT playlistId, videoId, title, artists, album, durationMs, thumbnailUrl, position FROM playlist_tracks WHERE playlistId = ? ORDER BY position ASC;",
    [playlistId]
  );
}

export async function addTrackToPlaylist(playlistId: number, track: Track) {
  const db = await getDbAsync();
  if (!db) return;

  let finalDurationMs = track.durationMs;
  if (!finalDurationMs || Number(finalDurationMs) === 0) {
    try {
      const pb = await getPlaybackTrack(track.videoId);
      if (pb && pb.durationMs) {
        finalDurationMs = pb.durationMs;
      }
    } catch (e) {
      console.warn("[DB] Failed to fetch missing duration on add:", track.videoId, e);
    }
  }

  const res = await db.getFirstAsync<{ maxPos: number }>(
    `SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlistId = ?`,
    [playlistId]
  );
  const position = (res?.maxPos ?? -1) + 1;

  await db.runAsync(
    `INSERT OR IGNORE INTO playlist_tracks (playlistId, videoId, title, artists, album, durationMs, thumbnailUrl, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      playlistId,
      track.videoId,
      track.title,
      JSON.stringify(track.artists),
      track.album,
      finalDurationMs,
      track.thumbnailUrl,
      position,
    ]
  );
  await db.runAsync(
    `UPDATE playlists SET updatedAt = datetime('now') WHERE id = ?`,
    [playlistId]
  );
  notifyPlaylistsChanged();
}

export async function updateTrackDuration(videoId: string, durationMs: number) {
  const db = await getDbAsync();
  if (!db) return;

  await db.runAsync(
    `UPDATE playlist_tracks SET durationMs = ? WHERE videoId = ?`,
    [durationMs, videoId]
  );
  await db.runAsync(
    `UPDATE recent_plays SET durationMs = ? WHERE videoId = ?`,
    [durationMs, videoId]
  );
  notifyPlaylistsChanged();
  notifyHistoryChanged();
}

export async function removeTrackFromPlaylist(
  playlistId: number,
  videoId: string
): Promise<void> {
  const database = await getDbAsync();
  if (!database) return;
  await database.runAsync(
    "DELETE FROM playlist_tracks WHERE playlistId = ? AND videoId = ?;",
    [playlistId, videoId]
  );
  notifyPlaylistsChanged();
}

export async function reorderPlaylistTrack(
  playlistId: number,
  videoId: string,
  newPosition: number
): Promise<void> {
  const database = await getDbAsync();
  if (!database) return;
  await database.runAsync(
    "UPDATE playlist_tracks SET position = ? WHERE playlistId = ? AND videoId = ?;",
    [newPosition, playlistId, videoId]
  );
  notifyPlaylistsChanged();
}

let getLikedPlaylistIdPromise: Promise<number> | null = null;

export function getLikedPlaylistId(): Promise<number> {
  if (!getLikedPlaylistIdPromise) {
    getLikedPlaylistIdPromise = (async () => {
      const database = await getDbAsync();
      if (!database) throw new Error("Database not initialized");
      const row = await database.getFirstAsync<{ id: number }>(
        "SELECT id FROM playlists WHERE isSystem = 1 AND name = 'Liked Songs';"
      );
      if (row) return row.id;
      // If we got here, it really doesn't exist, create it!
      const newPlaylist = await createPlaylist("Liked Songs", 1, "heart", "#f7768e");
      return newPlaylist.id;
    })().catch((e) => {
      getLikedPlaylistIdPromise = null;
      throw e;
    });
  }
  return getLikedPlaylistIdPromise;
}

export async function isTrackLiked(videoId: string): Promise<boolean> {
  const database = await getDbAsync();
  if (!database) return false;
  try {
    const playlistId = await getLikedPlaylistId();
    const row = await database.getFirstAsync<{ videoId: string }>(
      "SELECT videoId FROM playlist_tracks WHERE playlistId = ? AND videoId = ?;",
      [playlistId, videoId]
    );
    return row !== null;
  } catch (e) {
    return false;
  }
}

export async function getPlaylistIdsForTrack(videoId: string): Promise<Set<number>> {
  const database = await getDbAsync();
  if (!database) return new Set();
  const rows = await database.getAllAsync<{ playlistId: number }>(
    "SELECT playlistId FROM playlist_tracks WHERE videoId = ?;",
    [videoId]
  );
  return new Set(rows.map(r => r.playlistId));
}

export async function getLikedTrackIds(): Promise<Set<string>> {
  const database = await getDbAsync();
  if (!database) return new Set();
  try {
    const playlistId = await getLikedPlaylistId();
    const rows = await database.getAllAsync<{ videoId: string }>(
      "SELECT videoId FROM playlist_tracks WHERE playlistId = ?;",
      [playlistId]
    );
    return new Set(rows.map(r => r.videoId));
  } catch (e) {
    return new Set();
  }
}

// ── History ─────────────────────────────────────────────────────────────────

export async function addToHistory(track: Track): Promise<void> {
  const database = await getDbAsync();
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
  
  // Prune history to keep only the 20 most recent tracks
  await database.runAsync(`
    DELETE FROM recent_plays 
    WHERE videoId NOT IN (
      SELECT videoId FROM recent_plays 
      ORDER BY lastPlayedAt DESC 
      LIMIT 20
    );
  `);
  
  logger.debug(`[Database] addToHistory: Completed for "${track.title}" and pruned to 20 items. Notifying listeners.`);
  notifyHistoryChanged();
}

export async function getHistory(limit = 20): Promise<Track[]> {
  const database = await getDbAsync();
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
  const database = await getDbAsync();
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
  const database = await getDbAsync();
  if (!database) return;
  await database.runAsync("DELETE FROM playback_session WHERE id = 1;");
}

export async function getSavedPlaybackSession(): Promise<PlaybackSession | null> {
  const database = await getDbAsync();
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
  const database = await getDbAsync();
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
  notifyAlbumsChanged();
}

export async function getAlbums(): Promise<SavedAlbum[]> {
  const database = await getDbAsync();
  if (!database) return [];
  const rows = await database.getAllAsync<SavedAlbum>(
    `SELECT id, title, artists, thumbnailUrl, year, savedAt FROM saved_albums ORDER BY savedAt DESC;`
  );
  return rows;
}

export async function isAlbumSaved(id: string): Promise<boolean> {
  const database = await getDbAsync();
  if (!database) return false;
  const row = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM saved_albums WHERE id = ?;`,
    id
  );
  return row !== null;
}

export async function removeAlbum(id: string): Promise<void> {
  const database = await getDbAsync();
  if (!database) return;
  await database.runAsync(`DELETE FROM saved_albums WHERE id = ?;`, id);
  logger.debug(`[Database] removeAlbum: removed album ${id}`);
  notifyAlbumsChanged();
}
