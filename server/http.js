// Forwards errors thrown (or rejected) inside handlers to Express error middleware.
const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve()
        .then(() => handler(req, res, next))
        .catch(next);
};

// Error body shape expected by the mobile client: it reads the "message" field.
const errorBody = (errors) => ({
    message: Array.isArray(errors) ? errors.join(' ') : errors,
    errors: Array.isArray(errors) ? errors : [errors],
});

module.exports = { asyncHandler, errorBody };
