// RRP-29 / NFR-02: Editable restaurant fields only. Ownership and ratings have separate workflows.
const textLimits = { name: 120, cuisine: 80, description: 2000, phone: 50, openingHours: 500 };
const locationLimits = { address: 300, suburb: 100 };
const urlFields = ['menuUrl', 'websiteUrl'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class RestaurantInputError extends Error {}
const invalid = message => { throw new RestaurantInputError(message); };

function text(value, field, limit) {
    if (typeof value !== 'string') invalid(`${field} must be text.`);
    const trimmed = value.trim();
    if (trimmed.length > limit) invalid(`${field} must be at most ${limit} characters.`);
    return trimmed;
}

function url(value, field) {
    const trimmed = text(value, field, 2048);
    if (!trimmed) return '';
    try {
        const parsed = new URL(trimmed);
        if (!/^https?:\/\//i.test(trimmed) || !['http:', 'https:'].includes(parsed.protocol) ||
            !parsed.hostname || parsed.username || parsed.password || /\s/.test(trimmed)) throw new Error();
    } catch {
        invalid(`${field} must be a valid http or https URL.`);
    }
    return trimmed;
}

function validateRestaurantInput(body, creating = false) {
    if (!isObject(body)) invalid('Restaurant data must be an object.');
    const allowed = [...Object.keys(textLimits), ...urlFields, 'priceLevel', 'location', 'imageUrls'];
    if (Object.keys(body).some(key => !allowed.includes(key))) invalid('Restaurant data contains unsupported fields.');
    if (creating && !has(body, 'name')) invalid('Restaurant name is required.');
    const data = {};
    for (const [field, limit] of Object.entries(textLimits)) {
        if (has(body, field)) data[field] = text(body[field], field, limit);
    }
    if (has(data, 'name') && !data.name) invalid('Restaurant name is required.');
    if (has(body, 'priceLevel')) {
        if (!Number.isInteger(body.priceLevel) || body.priceLevel < 1 || body.priceLevel > 3) {
            invalid('Price level must be a whole number from 1 to 3.');
        }
        data.priceLevel = body.priceLevel;
    }
    for (const field of urlFields) {
        if (has(body, field)) data[field] = url(body[field], field);
    }
    if (has(body, 'imageUrls')) {
        if (!Array.isArray(body.imageUrls) || body.imageUrls.length > 10) invalid('Provide at most 10 image URLs.');
        data.imageUrls = body.imageUrls.map(value => {
            const result = url(value, 'Image URL');
            if (!result) invalid('Image URL cannot be empty.');
            return result;
        });
    }
    if (has(body, 'location')) {
        const location = body.location;
        const locationFields = [...Object.keys(locationLimits), 'mapsUrl', 'latitude', 'longitude'];
        if (!isObject(location) || Object.keys(location).some(key => !locationFields.includes(key))) {
            invalid('Location must contain only address, suburb, mapsUrl, latitude and longitude.');
        }
        data.location = {};
        for (const [field, limit] of Object.entries(locationLimits)) {
            if (has(location, field)) data.location[field] = text(location[field], field, limit);
        }
        if (has(location, 'mapsUrl')) data.location.mapsUrl = url(location.mapsUrl, 'Map URL');
        for (const [field, max] of [['latitude', 90], ['longitude', 180]]) {
            if (!has(location, field)) continue;
            const value = location[field];
            if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > max)) {
                invalid(`${field} must be a number between -${max} and ${max}, or null.`);
            }
            data.location[field] = value;
        }
        if (Object.keys(data.location).length === 0) delete data.location;
    }
    if (!Object.keys(data).length) invalid('Provide at least one editable restaurant field.');
    return data;
}

module.exports = { validateRestaurantInput, RestaurantInputError };
