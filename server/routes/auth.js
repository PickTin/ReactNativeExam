const express = require('express');
const { asyncHandler, errorBody } = require('../http');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const { validateRegistration, validateLogin } = require('../validation');
const { createUser, findUserByEmail } = require('../repository');

const toPublicUser = (user) => ({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
});

// Compared against when the email is unknown, so both failures take similar time.
let dummyHash = null;

const createAuthHandlers = ({ db, config }) => ({
    async register(req, res) {
        const { errors, value } = validateRegistration(req.body);
        if (errors.length) return res.status(400).json(errorBody(errors));

        if (findUserByEmail(db, value.email)) {
            return res.status(409).json(errorBody('A user with this email already exists.'));
        }

        const passwordHash = await hashPassword(value.password);
        const user = createUser(db, {
            firstName: value.firstName,
            lastName: value.lastName,
            email: value.email,
            passwordHash,
        });
        return res.status(201).json({ user: toPublicUser(user), token: signToken(user, config) });
    },

    async login(req, res) {
        const { errors, value } = validateLogin(req.body);
        if (errors.length) return res.status(400).json(errorBody(errors));

        const user = findUserByEmail(db, value.email);
        if (!user) {
            if (!dummyHash) dummyHash = await hashPassword('dummy-password');
            await verifyPassword(value.password, dummyHash);
            return res.status(401).json(errorBody('Incorrect email or password.'));
        }

        const matches = await verifyPassword(value.password, user.password);
        if (!matches) return res.status(401).json(errorBody('Incorrect email or password.'));

        return res.status(200).json({ user: toPublicUser(user), token: signToken(user, config) });
    },
});

const createAuthRouter = (deps) => {
    const router = express.Router();
    const handlers = createAuthHandlers(deps);
    router.post('/register', asyncHandler(handlers.register));
    router.post('/login', asyncHandler(handlers.login));
    return router;
};

module.exports = { createAuthRouter, createAuthHandlers };
