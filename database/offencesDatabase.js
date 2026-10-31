import * as SQLite from 'expo-sqlite';

const DB_NAME = 'law_abiding_citizen.db';

export const SYNC_STATUS = {
    SYNCED: 'synced',
    PENDING_CREATE: 'pending_create',
    PENDING_UPDATE: 'pending_update',
    PENDING_DELETE: 'pending_delete',
};

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
];

const LIST_COLUMNS = `id, server_id, description, image_url, date, time, user_id,
    latitude, longitude, sync_status, created_at, updated_at`;

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

export const updateOffence = async (id, userId, { description, date }) => {
    const db = await getDb();
    return await db.runAsync(
        `UPDATE offences
         SET description = ?, date = ?, updated_at = ?,
             sync_status = CASE WHEN sync_status = 'synced' THEN 'pending_update' ELSE sync_status END
         WHERE id = ? AND user_id = ?`,
        [description, date, new Date().toISOString(), id, String(userId)]
    );
};

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
});

export const fetchPendingOffences = async (userId) => {
    const db = await getDb();
    return await db.getAllAsync(
        'SELECT * FROM offences WHERE user_id = ? AND sync_status != ? ORDER BY id',
        [String(userId), SYNC_STATUS.SYNCED]
    );
};

export const markOffenceSynced = async (id, { serverId, imageUrl = null }) => {
    const db = await getDb();
    return await db.runAsync(
        `UPDATE offences
         SET server_id = ?, image_url = COALESCE(?, image_url), sync_status = ?
         WHERE id = ?`,
        [serverId, imageUrl, SYNC_STATUS.SYNCED, id]
    );
};
