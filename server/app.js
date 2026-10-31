const express = require('express');
const { createAuthRouter } = require('./routes/auth');
const { createOffencesRouter } = require('./routes/offences');
const { createUploadsRouter } = require('./routes/uploads');

const createApp = ({ db, config }) => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '100kb' }));

    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    app.use('/auth', createAuthRouter({ db, config }));
    app.use('/offences', createOffencesRouter({ db, config }));
    app.use('/uploads', createUploadsRouter({ db, config }));

    app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

    // eslint-disable-next-line no-unused-vars
    app.use((error, req, res, next) => {
        if (error.type === 'entity.parse.failed') {
            return res.status(400).json({ message: 'Request body is not valid JSON.' });
        }
        console.error(error);
        return res.status(500).json({ message: 'Internal server error.' });
    });

    return app;
};

module.exports = { createApp };
