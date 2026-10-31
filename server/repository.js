const USER_COLUMNS = 'id, first_name, last_name, email, password, created_at';
const OFFENCE_COLUMNS = `id, client_uuid, description, url, date, time, latitude, longitude,
    user_id, created_at, updated_at`;

const plain = (row) => (row ? { ...row } : null);

// ---------- users ----------

const findUserById = (db, id) =>
    plain(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id));

const findUserByEmail = (db, email) =>
    plain(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(email));

const createUser = (db, { firstName, lastName, email, passwordHash }) => {
    const result = db.prepare(
        'INSERT INTO users (first_name, last_name, email, password, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(firstName, lastName, email, passwordHash, new Date().toISOString());
    return findUserById(db, Number(result.lastInsertRowid));
};

// ---------- offences ----------

const getOffenceById = (db, id) =>
    plain(db.prepare(`SELECT ${OFFENCE_COLUMNS} FROM offences WHERE id = ? AND deleted_at IS NULL`).get(id));

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceKm = (lat1, lng1, lat2, lng2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Lists non-deleted offences, optionally filtered by date and/or by distance from a point.
// The SQL query narrows the search with a bounding box; the exact distance is checked afterwards.
const listOffences = (db, { date = null, near = null } = {}) => {
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (date) {
        conditions.push('date = ?');
        params.push(date);
    }

    if (near) {
        const latDelta = near.radiusKm / 111.32;
        const lngDelta = near.radiusKm / (111.32 * Math.max(Math.cos(toRadians(near.latitude)), 0.01));
        conditions.push('latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?');
        params.push(
            near.latitude - latDelta, near.latitude + latDelta,
            near.longitude - lngDelta, near.longitude + lngDelta
        );
    }

    const rows = db.prepare(
        `SELECT ${OFFENCE_COLUMNS} FROM offences WHERE ${conditions.join(' AND ')}
         ORDER BY date DESC, time DESC, id DESC`
    ).all(...params).map(plain);

    if (!near) return rows;

    return rows
        .map((row) => ({
            ...row,
            distance_km: Math.round(distanceKm(near.latitude, near.longitude, row.latitude, row.longitude) * 1000) / 1000,
        }))
        .filter((row) => row.distance_km <= near.radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km);
};

const listOffenceDates = (db) =>
    db.prepare('SELECT DISTINCT date FROM offences WHERE deleted_at IS NULL ORDER BY date DESC')
        .all()
        .map((row) => row.date);

const listOffenceLocations = (db) =>
    db.prepare(
        `SELECT id, latitude, longitude FROM offences
         WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY id`
    ).all().map(plain);

// Idempotent create: a repeated client_uuid returns the existing record instead of a duplicate.
const createOffence = (db, userId, data) => {
    const existing = plain(db.prepare(`SELECT ${OFFENCE_COLUMNS}, deleted_at FROM offences WHERE client_uuid = ?`).get(data.clientUuid));
    if (existing) {
        if (existing.deleted_at && existing.user_id === userId) {
            db.prepare('UPDATE offences SET deleted_at = NULL WHERE id = ?').run(existing.id);
            return { offence: updateOffence(db, existing.id, data), created: false };
        }
        const { deleted_at: deletedAt, ...offence } = existing;
        return { offence, created: false };
    }

    const now = new Date().toISOString();
    const result = db.prepare(
        `INSERT INTO offences
            (client_uuid, description, url, date, time, user_id, latitude, longitude, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        data.clientUuid, data.description, data.url, data.date, data.time, userId,
        data.latitude, data.longitude, data.createdAt || now, now
    );
    return { offence: getOffenceById(db, Number(result.lastInsertRowid)), created: true };
};

const updateOffence = (db, id, data) => {
    db.prepare(
        `UPDATE offences
         SET description = ?, url = ?, date = ?, time = ?, latitude = ?, longitude = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
    ).run(data.description, data.url, data.date, data.time, data.latitude, data.longitude, new Date().toISOString(), id);
    return getOffenceById(db, id);
};

const softDeleteOffence = (db, id) => {
    const now = new Date().toISOString();
    return db.prepare('UPDATE offences SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .run(now, now, id).changes > 0;
};

module.exports = {
    findUserById, findUserByEmail, createUser,
    getOffenceById, listOffences, listOffenceDates, listOffenceLocations,
    createOffence, updateOffence, softDeleteOffence, distanceKm,
};
