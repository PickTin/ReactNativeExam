const express = require('express');
const { asyncHandler, errorBody } = require('../http');
const { authenticate } = require('../auth');
const { isCloudinaryConfigured, createUploadSignature } = require('../cloudinary');

const createUploadHandlers = ({ config }) => ({
    signature(req, res) {
        if (!isCloudinaryConfigured(config)) {
            return res.status(503).json(errorBody('Cloudinary is not configured on the server.'));
        }
        return res.json(createUploadSignature(config));
    },
});

const createUploadsRouter = (deps) => {
    const router = express.Router();
    const handlers = createUploadHandlers(deps);
    router.post('/signature', authenticate(deps.config), asyncHandler(handlers.signature));
    return router;
};

module.exports = { createUploadsRouter, createUploadHandlers };
