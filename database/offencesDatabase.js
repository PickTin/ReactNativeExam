import * as SQLite from 'expo-sqlite';

const DB_NAME = 'law_abiding_citizen.db';
const DB_VERSION = 1;

export const SYNC_STATUS = {
    SYNCED: 'synced',                 // збігається з сервером
    PENDING_CREATE: 'pending_create', // створено офлайн, ще не відправлено
    PENDING_UPDATE: 'pending_update', // змінено офлайн
    PENDING_DELETE: 'pending_delete', // видалено офлайн (запис ховаємо, на сервері ще існує)
};

const LIST_COLUMNS = `id, server_id, description, image_url, date, user_id,
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

    if (version < 1) {
        await db.withTransactionAsync(async () => {
            await db.execAsync(`
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
            `);
            await db.execAsync(`PRAGMA user_version = ${DB_VERSION};`);
        });
    }
};

export const fetchAllOffences = async () => {
    const db = await getDb();
    return await db.getAllAsync(
        `SELECT ${LIST_COLUMNS} FROM offences
         WHERE sync_status != ? ORDER BY date DESC, id DESC`,
        [SYNC_STATUS.PENDING_DELETE]
    );
};

export const fetchOffencesByDate = async (date) => {
    const db = await getDb();
    return await db.getAllAsync(
        `SELECT ${LIST_COLUMNS} FROM offences
         WHERE date = ? AND sync_status != ? ORDER BY id DESC`,
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
    description, date, userId,
    latitude = null, longitude = null, image = null, imageUrl = null,
}) => {
    const db = await getDb();
    const now = new Date().toISOString();
    return await db.runAsync(
        `INSERT INTO offences
            (client_uuid, description, image, image_url, date, user_id,
             latitude, longitude, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [createUuid(), description, image, imageUrl, date, String(userId),
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
