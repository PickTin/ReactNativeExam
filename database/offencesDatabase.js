import * as SQLite from 'expo-sqlite';

const DB_NAME = 'law_abiding_citizen.db';

export const SYNC_STATUS = {
    SYNCED: 'synced',
    PENDING_CREATE: 'pending_create',
    PENDING_UPDATE: 'pending_update',
    PENDING_DELETE: 'pending_delete',
};

// Each entry is applied once; the applied count is stored in PRAGMA user_version.
const MIGRATIONS = [
    `
    CREATE TABLE IF NOT EXISTS offences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_uuid TEXT NOT NULL UNIQUE,
        server_id INTEGER UNIQUE,
        description TEXT NOT NULL,
        image BLOB,
        image_url TEXT,
        date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        sync_status TEXT NOT NULL DEFAULT 'pending_create',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_offences_date ON offences(date);
    CREATE INDEX IF NOT EXISTS idx_offences_sync ON offences(sync_status);
    `,
    `ALTER TABLE offences ADD COLUMN time TEXT;`,
    `ALTER TABLE offences ADD COLUMN sync_error TEXT;`,
];

// List queries skip the BLOB column to keep memory usage low.
const LIST_COLUMNS = `id, client_uuid, server_id, description, image_url, date, time, user_id,
    latitude, longitude, sync_status, sync_error, created_at, updated_at`;

let dbPromise = null;

const getDb = () => {
    if (!dbPromise) {
        dbPromise = SQLite.openDatabaseAsync(DB_NAME).catch((error) => {
            dbPromise = null;
            throw error;
        });
    }
    return dbPromise;
};

export const toDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const toTimeString = (date = new Date()) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const createUuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

export const initDatabase = async () => {
    const db = await getDb();
    await db.execAsync('PRAGMA journal_mode = WAL;');

    const row = await db.getFirstAsync('PRAGMA user_version');
    const version = row?.user_version ?? 0;

    for (let i = version; i < MIGRATIONS.length; i++) {
        await db.withTransactionAsync(async () => {
            await db.execAsync(MIGRATIONS[i]);
            await db.execAsync(`PRAGMA user_version = ${i + 1};`);
        });
    }
};

export const fetchAllOffences = async () => {
    const db = await getDb();
    return await db.getAllAsync(
        `SELECT ${LIST_COLUMNS} FROM offences
         WHERE sync_status != ? ORDER BY date DESC, time DESC, id DESC`,
        [SYNC_STATUS.PENDING_DELETE]
    );
};

export const fetchOffencesByDate = async (date) => {
    const db = await getDb();
    return await db.getAllAsync(
        `SELECT ${LIST_COLUMNS} FROM offences
         WHERE date = ? AND sync_status != ? ORDER BY time DESC, id DESC`,
        [date, SYNC_STATUS.PENDING_DELETE]
    );
};

export const fetchOffence = async (id) => {
    const db = await getDb();
    return await db.getFirstAsync(
        'SELECT * FROM offences WHERE id = ? AND sync_status != ?',
        [id, SYNC_STATUS.PENDING_DELETE]
    );
};

export const fetchOffenceDates = async () => {
    const db = await getDb();
    return await db.getAllAsync(
        'SELECT DISTINCT date FROM offences WHERE sync_status != ?',
        [SYNC_STATUS.PENDING_DELETE]
    );
};

export const insertOffence = async ({
    description, date, time = null, userId,
    latitude = null, longitude = null, image = null, imageUrl = null,
}) => {
    const db = await getDb();
    const now = new Date().toISOString();
    return await db.runAsync(
        `INSERT INTO offences
            (client_uuid, description, image, image_url, date, time, user_id,
             latitude, longitude, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [createUuid(), description, image, imageUrl, date, time, String(userId),
         latitude, longitude, SYNC_STATUS.PENDING_CREATE, now, now]
    );
};

// A synced record becomes pending_update; a record that was never sent stays pending_create.
export const updateOffence = async (id, userId, { description, date, latitude = null, longitude = null }) => {
    const db = await getDb();
    return await db.runAsync(
        `UPDATE offences
         SET description = ?, date = ?, latitude = ?, longitude = ?, updated_at = ?, sync_error = NULL,
             sync_status = CASE WHEN sync_status = 'synced' THEN 'pending_update' ELSE sync_status END
         WHERE id = ? AND user_id = ? AND sync_status != 'pending_delete'`,
        [description, date, latitude, longitude, new Date().toISOString(), id, String(userId)]
    );
};

// A record the server has never seen is deleted at once; a synced one is only marked
// pending_delete so that the deletion can be sent to the server later.
export const deleteOffence = async (id, userId) => {
    const db = await getDb();
    await db.runAsync(
        'DELETE FROM offences WHERE id = ? AND user_id = ? AND server_id IS NULL',
        [id, String(userId)]
    );
    await db.runAsync(
        `UPDATE offences SET sync_status = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND server_id IS NOT NULL`,
        [SYNC_STATUS.PENDING_DELETE, new Date().toISOString(), id, String(userId)]
    );
};

export const buildOffencePayload = (offence) => ({
    client_uuid: offence.client_uuid,
    description: offence.description,
    date: offence.date,
    time: offence.time,
    latitude: offence.latitude,
    longitude: offence.longitude,
    created_at: offence.created_at,
    url: offence.image_url,
});

// Sync queue: every record of the user that is not synced yet.
export const fetchPendingOffences = async (userId) => {
    const db = await getDb();
    return await db.getAllAsync(
        `SELECT ${LIST_COLUMNS}, (image IS NOT NULL) AS has_image FROM offences
         WHERE user_id = ? AND sync_status != ? ORDER BY id`,
        [String(userId), SYNC_STATUS.SYNCED]
    );
};

export const fetchOffenceImage = async (id) => {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT image FROM offences WHERE id = ?', [id]);
    return row?.image ?? null;
};

// Remembers the Cloudinary URL right after upload so a retry never uploads the photo twice.
export const setOffenceImageUrl = async (id, imageUrl) => {
    const db = await getDb();
    return await db.runAsync('UPDATE offences SET image_url = ? WHERE id = ?', [imageUrl, id]);
};

// Marks a record as synced only if it was not edited while the request was in flight;
// otherwise it stays in the queue as pending_update.
export const markOffenceSynced = async (id, { serverId, imageUrl = null, expectedUpdatedAt }) => {
    const db = await getDb();
    return await db.runAsync(
        `UPDATE offences
         SET server_id = ?, image_url = COALESCE(?, image_url), sync_error = NULL,
             sync_status = CASE WHEN updated_at = ? THEN 'synced' ELSE 'pending_update' END
         WHERE id = ?`,
        [serverId, imageUrl, expectedUpdatedAt, id]
    );
};

export const markOffenceSyncError = async (id, message) => {
    const db = await getDb();
    return await db.runAsync('UPDATE offences SET sync_error = ? WHERE id = ?', [message, id]);
};

// Pull sync: merges the server's list into SQLite.
// Local records with pending changes are never overwritten; synced records that no longer
// exist on the server are removed.
export const applyRemoteOffences = async (remoteList) => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        const remoteIds = new Set();
        for (const remote of remoteList) {
            remoteIds.add(remote.id);

            const byServerId = await db.getFirstAsync(
                'SELECT id, sync_status FROM offences WHERE server_id = ?',
                [remote.id]
            );
            if (byServerId) {
                if (byServerId.sync_status === SYNC_STATUS.SYNCED) {
                    await db.runAsync(
                        `UPDATE offences
                         SET description = ?, image_url = COALESCE(?, image_url), date = ?, time = ?,
                             latitude = ?, longitude = ?, user_id = ?, created_at = ?, updated_at = ?
                         WHERE id = ?`,
                        [remote.description, remote.url ?? null, remote.date, remote.time ?? null,
                         remote.latitude ?? null, remote.longitude ?? null, String(remote.user_id),
                         remote.created_at, remote.updated_at, byServerId.id]
                    );
                }
                continue;
            }

            const byUuid = await db.getFirstAsync(
                'SELECT id FROM offences WHERE client_uuid = ?',
                [remote.client_uuid]
            );
            if (byUuid) continue;

            await db.runAsync(
                `INSERT INTO offences
                    (client_uuid, server_id, description, image, image_url, date, time, user_id,
                     latitude, longitude, sync_status, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [remote.client_uuid, remote.id, remote.description, remote.url ?? null, remote.date,
                 remote.time ?? null, String(remote.user_id), remote.latitude ?? null,
                 remote.longitude ?? null, SYNC_STATUS.SYNCED, remote.created_at, remote.updated_at]
            );
        }

        const synced = await db.getAllAsync(
            'SELECT id, server_id FROM offences WHERE sync_status = ? AND server_id IS NOT NULL',
            [SYNC_STATUS.SYNCED]
        );
        for (const row of synced) {
            if (!remoteIds.has(row.server_id)) {
                await db.runAsync('DELETE FROM offences WHERE id = ?', [row.id]);
            }
        }
    });
};

// Removes a record after its deletion has been confirmed by the server.
export const purgeOffence = async (id) => {
    const db = await getDb();
    return await db.runAsync(
        'DELETE FROM offences WHERE id = ? AND sync_status = ?',
        [id, SYNC_STATUS.PENDING_DELETE]
    );
};
