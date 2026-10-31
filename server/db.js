const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Opens the SQLite file (or :memory: in tests) and makes sure the schema exists.
const openDatabase = (dbPath) => {
    if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    return db;
};

module.exports = { openDatabase };
