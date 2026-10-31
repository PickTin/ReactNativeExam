const crypto = require('crypto');

const UPLOAD_FOLDER = 'law-abiding-citizen';

const isCloudinaryConfigured = (config) =>
    Boolean(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET);

// Cloudinary signature: sort the parameters, join them as key=value pairs with "&",
// append the API secret and take the SHA-1 hex digest.
const signParams = (params, apiSecret) => {
    const toSign = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');
    return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
};

// The secret never leaves the server: the app only receives a short-lived signature.
const createUploadSignature = (config, nowMs = Date.now()) => {
    const timestamp = Math.floor(nowMs / 1000);
    const params = { folder: UPLOAD_FOLDER, timestamp };
    return {
        cloud_name: config.CLOUDINARY_CLOUD_NAME,
        api_key: config.CLOUDINARY_API_KEY,
        timestamp,
        folder: UPLOAD_FOLDER,
        signature: signParams(params, config.CLOUDINARY_API_SECRET),
    };
};

// Only HTTPS images hosted by Cloudinary (and by our cloud, when known) can be stored as a photo URL.
const isAllowedImageUrl = (value, cloudName) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:'
            && url.hostname === 'res.cloudinary.com'
            && (!cloudName || url.pathname.startsWith(`/${cloudName}/`));
    } catch (error) {
        return false;
    }
};

module.exports = { isCloudinaryConfigured, signParams, createUploadSignature, isAllowedImageUrl, UPLOAD_FOLDER };
