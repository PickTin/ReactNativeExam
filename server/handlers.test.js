const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('./db');
const { createAuthHandlers } = require('./routes/auth');
const { createOffenceHandlers } = require('./routes/offences');
const { createUploadHandlers } = require('./routes/uploads');
const { authenticate } = require('./auth');
const repo = require('./repository');

const CONFIG = {
    JWT_SECRET: 'test-secret-with-enough-length', JWT_EXPIRES_IN: '1h',
    CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
};

const createRes = () => ({
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
});

const call = async (handler, req) => {
    const res = createRes();
    await handler({ body: {}, params: {}, query: {}, headers: {}, ...req }, res);
    return res;
};

const setup = () => {
    const db = openDatabase(':memory:');
    return {
        db,
        auth: createAuthHandlers({ db, config: CONFIG }),
        offences: createOffenceHandlers({ db, config: CONFIG }),
    };
};

const register = (auth, email) => call(auth.register, {
    body: { first_name: 'Ann', last_name: 'Lee', email, password: 'secret123' },
});

const payload = (uuid, overrides = {}) => ({
    client_uuid: uuid, description: 'Illegal parking', date: '2026-10-20', time: '14:30:00',
    latitude: 49.99, longitude: 36.23, created_at: '2026-10-30T10:00:00.000Z', url: null, ...overrides,
});

const UUID_A = '11111111-1111-4111-8111-111111111111';

test('register hashes the password and returns user and token', async () => {
    const { db, auth } = setup();
    const res = await register(auth, 'Ann@Example.com');
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.user.email, 'ann@example.com');
    assert.equal(res.body.user.password, undefined);
    assert.ok(res.body.token);
    assert.notEqual(repo.findUserByEmail(db, 'ann@example.com').password, 'secret123');
});

test('register rejects duplicates and invalid input', async () => {
    const { auth } = setup();
    await register(auth, 'ann@example.com');
    assert.equal((await register(auth, 'ann@example.com')).statusCode, 409);
    const bad = await call(auth.register, { body: { email: 'x' } });
    assert.equal(bad.statusCode, 400);
    assert.ok(bad.body.message.length > 0);
});

test('login succeeds with correct password and fails otherwise', async () => {
    const { auth } = setup();
    await register(auth, 'ann@example.com');
    const ok = await call(auth.login, { body: { email: 'ANN@example.com', password: 'secret123' } });
    assert.equal(ok.statusCode, 200);
    assert.ok(ok.body.token);
    assert.equal((await call(auth.login, { body: { email: 'ann@example.com', password: 'wrong' } })).statusCode, 401);
    assert.equal((await call(auth.login, { body: { email: 'none@example.com', password: 'secret123' } })).statusCode, 401);
});

test('authenticate middleware', async () => {
    const { auth } = setup();
    const { body } = await register(auth, 'ann@example.com');
    const middleware = authenticate(CONFIG);

    const missing = createRes();
    middleware({ headers: {} }, missing, () => assert.fail('must not continue'));
    assert.equal(missing.statusCode, 401);

    const invalid = createRes();
    middleware({ headers: { authorization: 'Bearer nonsense' } }, invalid, () => assert.fail('must not continue'));
    assert.equal(invalid.statusCode, 401);

    const req = { headers: { authorization: `Bearer ${body.token}` } };
    let passed = false;
    middleware(req, createRes(), () => { passed = true; });
    assert.equal(passed, true);
    assert.equal(req.user.id, body.user.id);
});

test('offence lifecycle: create, repeat, update, delete', async () => {
    const { offences, auth } = setup();
    const owner = (await register(auth, 'owner@example.com')).body.user;
    const other = (await register(auth, 'other@example.com')).body.user;

    const created = await call(offences.create, { user: { id: owner.id }, body: payload(UUID_A) });
    assert.equal(created.statusCode, 201);
    const id = created.body.id;

    const repeated = await call(offences.create, { user: { id: owner.id }, body: payload(UUID_A) });
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.body.id, id);

    const stolen = await call(offences.create, { user: { id: other.id }, body: payload(UUID_A) });
    assert.equal(stolen.statusCode, 409);

    const forbidden = await call(offences.update, { user: { id: other.id }, params: { id }, body: payload(UUID_A) });
    assert.equal(forbidden.statusCode, 403);

    const updated = await call(offences.update, {
        user: { id: owner.id }, params: { id }, body: payload(UUID_A, { description: 'Edited', latitude: null, longitude: null }),
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.description, 'Edited');

    assert.equal((await call(offences.update, { user: { id: owner.id }, params: { id }, body: { description: '' } })).statusCode, 400);

    assert.equal((await call(offences.remove, { user: { id: other.id }, params: { id } })).statusCode, 403);
    const removed = await call(offences.remove, { user: { id: owner.id }, params: { id } });
    assert.equal(removed.statusCode, 204);
    assert.equal(removed.ended, true);
    assert.equal((await call(offences.get, { params: { id } })).statusCode, 404);
    assert.equal((await call(offences.remove, { user: { id: owner.id }, params: { id } })).statusCode, 404);
});

test('read endpoints are public and filterable', async () => {
    const { offences, auth } = setup();
    const owner = (await register(auth, 'owner@example.com')).body.user;
    await call(offences.create, { user: { id: owner.id }, body: payload(UUID_A) });
    await call(offences.create, {
        user: { id: owner.id },
        body: payload('22222222-2222-4222-8222-222222222222', { date: '2026-10-21', latitude: null, longitude: null }),
    });

    assert.deepEqual((await call(offences.dates, {})).body.dates, ['2026-10-21', '2026-10-20']);
    assert.equal((await call(offences.locations, {})).body.locations.length, 1);
    assert.equal((await call(offences.list, {})).body.offences.length, 2);
    assert.equal((await call(offences.list, { query: { date: '2026-10-20' } })).body.offences.length, 1);
    assert.equal((await call(offences.list, { query: { lat: '49.99', lng: '36.23', radius: '1' } })).body.offences.length, 1);
    assert.equal((await call(offences.list, { query: { lat: '49.99' } })).statusCode, 400);
});

test('upload signature requires Cloudinary configuration', async () => {
    const unconfigured = createUploadHandlers({ config: CONFIG });
    assert.equal((await call(unconfigured.signature, {})).statusCode, 503);

    const configured = createUploadHandlers({
        config: { ...CONFIG, CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' },
    });
    const res = await call(configured.signature, {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.cloud_name, 'demo');
    assert.ok(res.body.signature);
    assert.equal(res.body.api_secret, undefined);
});
