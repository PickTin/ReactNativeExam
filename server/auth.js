const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 10;

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

// The token carries only the user id ("sub"); everything else is read from the database.
const signToken = (user, config) =>
    jwt.sign({ sub: String(user.id) }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

// Express middleware: requires "Authorization: Bearer <token>" and sets req.user = { id }.
const authenticate = (config) => (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    try {
        const payload = jwt.verify(token, config.JWT_SECRET);
        req.user = { id: Number(payload.sub) };
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = { hashPassword, verifyPassword, signToken, authenticate };
