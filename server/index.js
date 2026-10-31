const config = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');
const { isCloudinaryConfigured } = require('./cloudinary');

if (config.JWT_SECRET.length < 16) {
    console.error('JWT_SECRET is missing or too short (min 16 characters). Set it in the .env file.');
    process.exit(1);
}

const db = openDatabase(config.DB_PATH);
const app = createApp({ db, config });

// 0.0.0.0 makes the server reachable from a phone in the same network.
app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${config.PORT}`);
    console.log(`Database: ${config.DB_PATH}`);
    if (!isCloudinaryConfigured(config)) {
        console.warn('Cloudinary is not configured: photo uploads are disabled (POST /uploads/signature returns 503).');
    }
});
