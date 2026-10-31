const { isAllowedImageUrl } = require('./cloudinary');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isEmpty = (value) => value === undefined || value === null || value === '';

const validateRegistration = (body) => {
    const errors = [];
    const input = body || {};
    const firstName = typeof input.first_name === 'string' ? input.first_name.trim() : '';
    const lastName = typeof input.last_name === 'string' ? input.last_name.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (!firstName || firstName.length > 100) errors.push('first_name is required (max 100 characters).');
    if (!lastName || lastName.length > 100) errors.push('last_name is required (max 100 characters).');
    if (!EMAIL_REGEX.test(email) || email.length > 255) errors.push('A valid email is required.');
    if (password.length < 6 || password.length > 72) errors.push('password must be 6 to 72 characters long.');

    return { errors, value: { firstName, lastName, email, password } };
};

const validateLogin = (body) => {
    const input = body || {};
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const errors = [];
    if (!email) errors.push('email is required.');
    if (!password) errors.push('password is required.');
    return { errors, value: { email, password } };
};

// Validates an offence body. On create the client_uuid is required; on update it is ignored.
const validateOffence = (body, { requireUuid = false, cloudName = '' } = {}) => {
    const errors = [];
    const input = body || {};

    let clientUuid = null;
    if (requireUuid) {
        if (typeof input.client_uuid !== 'string' || !UUID_REGEX.test(input.client_uuid)) {
            errors.push('client_uuid must be a valid UUID.');
        } else {
            clientUuid = input.client_uuid.toLowerCase();
        }
    }

    const description = typeof input.description === 'string' ? input.description.trim() : '';
    if (!description || description.length > 2000) {
        errors.push('description is required (max 2000 characters).');
    }

    if (!isValidDate(input.date)) errors.push('date must be a valid date in YYYY-MM-DD format.');

    let time = null;
    if (!isEmpty(input.time)) {
        if (typeof input.time === 'string' && TIME_REGEX.test(input.time)) {
            time = input.time;
        } else {
            errors.push('time must be in HH:MM or HH:MM:SS format.');
        }
    }

    let latitude = null;
    let longitude = null;
    const hasLatitude = !isEmpty(input.latitude);
    const hasLongitude = !isEmpty(input.longitude);
    if (hasLatitude !== hasLongitude) {
        errors.push('latitude and longitude must be provided together.');
    } else if (hasLatitude) {
        const lat = Number(input.latitude);
        const lng = Number(input.longitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push('latitude must be between -90 and 90.');
        else if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push('longitude must be between -180 and 180.');
        else {
            latitude = lat;
            longitude = lng;
        }
    }

    let url = null;
    if (!isEmpty(input.url)) {
        if (typeof input.url === 'string' && isAllowedImageUrl(input.url, cloudName)) {
            url = input.url;
        } else {
            errors.push('url must be an HTTPS image URL hosted by Cloudinary.');
        }
    }

    let createdAt = null;
    if (!isEmpty(input.created_at)) {
        const parsed = new Date(input.created_at);
        if (Number.isNaN(parsed.getTime())) {
            errors.push('created_at must be a valid date-time.');
        } else {
            createdAt = parsed.toISOString();
        }
    }

    return {
        errors,
        value: { clientUuid, description, date: input.date, time, latitude, longitude, url, createdAt },
    };
};

// Parses the query string of GET /offences.
const parseOffenceQuery = (query) => {
    const errors = [];
    const result = { date: null, near: null };

    if (!isEmpty(query.date)) {
        if (isValidDate(query.date)) result.date = query.date;
        else errors.push('date must be a valid date in YYYY-MM-DD format.');
    }

    const hasLat = !isEmpty(query.lat);
    const hasLng = !isEmpty(query.lng);
    if (hasLat !== hasLng) {
        errors.push('lat and lng must be provided together.');
    } else if (hasLat) {
        const latitude = Number(query.lat);
        const longitude = Number(query.lng);
        const radiusKm = isEmpty(query.radius) ? 5 : Number(query.radius);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('lat must be between -90 and 90.');
        else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('lng must be between -180 and 180.');
        else if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) errors.push('radius must be between 0 and 500 km.');
        else result.near = { latitude, longitude, radiusKm };
    }

    return { errors, value: result };
};

module.exports = { isValidDate, validateRegistration, validateLogin, validateOffence, parseOffenceQuery };
