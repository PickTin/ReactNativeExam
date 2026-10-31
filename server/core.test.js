const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('./db');
const repo = require('./repository');
const { validateOffence, validateRegistration, parseOffenceQuery, isValidDate } = require('./validation');
const { signParams, createUploadSignature, isAllowedImageUrl } = require('./cloudinary');

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

const newUser = (db, email) =>
    repo.createUser(db, { firstName: 'Test', lastName: 'User', email, passwordHash: 'hash' });

const offenceData = (overrides = {}) => ({
    clientUuid: UUID_A, description: 'Parked on the sidewalk', date: '2026-10-20', time: '14:30:00',
    latitude: 49.99, longitude: 36.23, url: null, createdAt: '2026-10-30T10:00:00.000Z', ...overrides,
});

test('schema is created and email is unique', () => {
    const db = openDatabase(':memory:');
    newUser(db, 'a@example.com');
    assert.throws(() => newUser(db, 'A@example.com'));
});

test('createOffence is idempotent by client_uuid', () => {
    const db = openDatabase(':memory:');
    const user = newUser(db, 'a@example.com');
    const first = repo.createOffence(db, user.id, offenceData());
    const second = repo.createOffence(db, user.id, offenceData({ description: 'Changed' }));
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.offence.id, first.offence.id);
    assert.equal(second.offence.description, 'Parked on the sidewalk');
    assert.equal(first.offence.created_at, '2026-10-30T10:00:00.000Z');
    assert.equal(repo.listOffences(db).length, 1);
});

test('offence date is independent from created_at', () => {
    const db = openDatabase(':memory:');
    const user = newUser(db, 'a@example.com');
    repo.createOffence(db, user.id, offenceData());
    assert.deepEqual(repo.listOffenceDates(db), ['2026-10-20']);
    assert.equal(repo.listOffences(db, { date: '2026-10-20' }).length, 1);
    assert.equal(repo.listOffences(db, { date: '2026-10-30' }).length, 0);
});

test('update and soft delete', () => {
    const db = openDatabase(':memory:');
    const user = newUser(db, 'a@example.com');
    const { offence } = repo.createOffence(db, user.id, offenceData());
    const updated = repo.updateOffence(db, offence.id, offenceData({ description: 'New text', latitude: null, longitude: null }));
    assert.equal(updated.description, 'New text');
    assert.equal(updated.latitude, null);
    assert.equal(repo.softDeleteOffence(db, offence.id), true);
    assert.equal(repo.softDeleteOffence(db, offence.id), false);
    assert.equal(repo.getOffenceById(db, offence.id), null);
    assert.deepEqual(repo.listOffenceDates(db), []);
});

test('re-sending a soft-deleted record revives it for the same user only', () => {
    const db = openDatabase(':memory:');
    const owner = newUser(db, 'a@example.com');
    const other = newUser(db, 'b@example.com');
    const { offence } = repo.createOffence(db, owner.id, offenceData());
    repo.softDeleteOffence(db, offence.id);

    const foreign = repo.createOffence(db, other.id, offenceData());
    assert.equal(foreign.offence.user_id, owner.id);
    assert.equal(repo.getOffenceById(db, offence.id), null);

    const revived = repo.createOffence(db, owner.id, offenceData({ description: 'Back again' }));
    assert.equal(revived.created, false);
    assert.equal(revived.offence.id, offence.id);
    assert.equal(repo.getOffenceById(db, offence.id).description, 'Back again');
});

test('locations skip records without coordinates; search by distance', () => {
    const db = openDatabase(':memory:');
    const user = newUser(db, 'a@example.com');
    repo.createOffence(db, user.id, offenceData());
    repo.createOffence(db, user.id, offenceData({ clientUuid: UUID_B, latitude: null, longitude: null }));
    repo.createOffence(db, user.id, offenceData({ clientUuid: '33333333-3333-4333-8333-333333333333', latitude: 50.45, longitude: 30.52 }));
    assert.equal(repo.listOffenceLocations(db).length, 2);

    const near = repo.listOffences(db, { near: { latitude: 49.99, longitude: 36.23, radiusKm: 5 } });
    assert.equal(near.length, 1);
    assert.equal(near[0].distance_km, 0);

    const wide = repo.listOffences(db, { near: { latitude: 49.99, longitude: 36.23, radiusKm: 500 } });
    assert.equal(wide.length, 2);
    assert.ok(wide[0].distance_km <= wide[1].distance_km);
});

test('offence validation', () => {
    const good = validateOffence({
        client_uuid: UUID_A, description: ' text ', date: '2026-10-20', time: '14:30',
        latitude: 49.99, longitude: 36.23, url: null, created_at: '2026-10-30T10:00:00Z',
    }, { requireUuid: true });
    assert.deepEqual(good.errors, []);
    assert.equal(good.value.description, 'text');

    assert.ok(validateOffence({ description: 'x', date: '2026-02-30' }).errors.length > 0);
    assert.ok(validateOffence({ description: '', date: '2026-10-20' }).errors.length > 0);
    assert.ok(validateOffence({ description: 'x', date: '2026-10-20', latitude: 10 }).errors.length > 0);
    assert.ok(validateOffence({ description: 'x', date: '2026-10-20', latitude: 100, longitude: 0 }).errors.length > 0);
    assert.ok(validateOffence({ description: 'x', date: '2026-10-20', url: 'http://evil.example/a.jpg' }).errors.length > 0);
    assert.ok(validateOffence({ description: 'x', date: '2026-10-20' }, { requireUuid: true }).errors.length > 0);

    const empty = validateOffence({ description: 'x', date: '2026-10-20' });
    assert.deepEqual(empty.errors, []);
    assert.equal(empty.value.latitude, null);
    assert.equal(empty.value.url, null);
});

test('registration and query validation', () => {
    assert.deepEqual(validateRegistration({ first_name: 'A', last_name: 'B', email: 'a@b.co', password: '123456' }).errors, []);
    assert.ok(validateRegistration({ first_name: 'A', last_name: 'B', email: 'bad', password: '123' }).errors.length >= 2);
    assert.ok(parseOffenceQuery({ lat: '10' }).errors.length > 0);
    assert.ok(parseOffenceQuery({ date: 'nope' }).errors.length > 0);
    assert.deepEqual(parseOffenceQuery({ lat: '10', lng: '20' }).value.near, { latitude: 10, longitude: 20, radiusKm: 5 });
    assert.equal(isValidDate('2026-10-31'), true);
});

test('Cloudinary signature matches the documented example', () => {
    const signature = signParams({
        eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        public_id: 'sample_image',
        timestamp: '1315060510',
    }, 'abcd');
    assert.equal(signature, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('upload signature never contains the secret; URL check', () => {
    const config = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'top-secret' };
    const result = createUploadSignature(config, 1700000000000);
    assert.equal(result.timestamp, 1700000000);
    assert.equal(result.cloud_name, 'demo');
    assert.ok(!JSON.stringify(result).includes('top-secret'));
    assert.equal(isAllowedImageUrl('https://res.cloudinary.com/demo/image/upload/a.jpg', 'demo'), true);
    assert.equal(isAllowedImageUrl('https://res.cloudinary.com/other/image/upload/a.jpg', 'demo'), false);
    assert.equal(isAllowedImageUrl('http://res.cloudinary.com/demo/a.jpg', 'demo'), false);
    assert.equal(isAllowedImageUrl('https://example.com/demo/a.jpg', 'demo'), false);
});
