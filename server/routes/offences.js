const express = require('express');
const { asyncHandler, errorBody } = require('../http');
const { authenticate } = require('../auth');
const { validateOffence, parseOffenceQuery } = require('../validation');
const {
    getOffenceById, listOffences, listOffenceDates, listOffenceLocations,
    createOffence, updateOffence, softDeleteOffence,
} = require('../repository');

const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const createOffenceHandlers = ({ db, config }) => {
    // Loads the record and checks that the current user owns it.
    const findOwned = (req, res) => {
        const id = parseId(req.params.id);
        const offence = id ? getOffenceById(db, id) : null;
        if (!offence) {
            res.status(404).json(errorBody('Offence not found.'));
            return null;
        }
        if (offence.user_id !== req.user.id) {
            res.status(403).json(errorBody('You can only modify your own offences.'));
            return null;
        }
        return offence;
    };

    return {
        list(req, res) {
            const { errors, value } = parseOffenceQuery(req.query);
            if (errors.length) return res.status(400).json(errorBody(errors));
            return res.json({ offences: listOffences(db, value) });
        },

        dates(req, res) {
            return res.json({ dates: listOffenceDates(db) });
        },

        locations(req, res) {
            return res.json({ locations: listOffenceLocations(db) });
        },

        get(req, res) {
            const id = parseId(req.params.id);
            const offence = id ? getOffenceById(db, id) : null;
            if (!offence) return res.status(404).json(errorBody('Offence not found.'));
            return res.json(offence);
        },

        create(req, res) {
            const { errors, value } = validateOffence(req.body, {
                requireUuid: true,
                cloudName: config.CLOUDINARY_CLOUD_NAME,
            });
            if (errors.length) return res.status(400).json(errorBody(errors));

            const { offence, created } = createOffence(db, req.user.id, value);
            if (offence.user_id !== req.user.id) {
                return res.status(409).json(errorBody('This client_uuid belongs to another user.'));
            }
            return res.status(created ? 201 : 200).json(offence);
        },

        update(req, res) {
            const existing = findOwned(req, res);
            if (!existing) return undefined;

            const { errors, value } = validateOffence(req.body, { cloudName: config.CLOUDINARY_CLOUD_NAME });
            if (errors.length) return res.status(400).json(errorBody(errors));

            return res.json(updateOffence(db, existing.id, value));
        },

        remove(req, res) {
            const existing = findOwned(req, res);
            if (!existing) return undefined;

            softDeleteOffence(db, existing.id);
            return res.status(204).end();
        },
    };
};

const createOffencesRouter = (deps) => {
    const router = express.Router();
    const handlers = createOffenceHandlers(deps);
    const requireAuth = authenticate(deps.config);

    // Static paths must be registered before "/:id".
    router.get('/dates', asyncHandler(handlers.dates));
    router.get('/locations', asyncHandler(handlers.locations));
    router.get('/', asyncHandler(handlers.list));
    router.get('/:id', asyncHandler(handlers.get));
    router.post('/', requireAuth, asyncHandler(handlers.create));
    router.put('/:id', requireAuth, asyncHandler(handlers.update));
    router.delete('/:id', requireAuth, asyncHandler(handlers.remove));
    return router;
};

module.exports = { createOffencesRouter, createOffenceHandlers };
