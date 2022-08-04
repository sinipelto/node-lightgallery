const utils = require('./utils.js');
const activityManager = require('./activity.js');

const fs = require('fs');
const NodeCache = require('node-cache');

const TOKEN_LENGTH = Number(process.env.TOKEN_LENGTH);
const TABLE = process.env.TOKEN_TABLE;

const CACHE_ENABLED = process.env.ENABLE_KEY_CACHE;
const CACHE_TTL = Number(process.env.KEY_CACHE_TTL);
const CACHE_PERIOD = Number(process.env.KEY_CACHE_CHECK_PERIOD);
const CACHE_CLONES = process.env.KEY_CACHE_CLONES;
const CACHE_DELETE_EXPIRED = process.env.KEY_CACHE_DELETE_ON_EXPIRE;

if (CACHE_ENABLED === true) {
	if (isNaN(CACHE_TTL)) {
		throw "Invalid or missing cache TTL. Check config.";
	}
	if (isNaN(CACHE_PERIOD)) {
		throw "Invalid or missing value KEY_CACHE_CHECK_PERIOD. Check config.";
	}
	if (CACHE_CLONES === undefined || CACHE_CLONES == '') {
		throw "Invalid value for CACHE_CLONES. Check config.";
	}
	if (CACHE_DELETE_EXPIRED === undefined || CACHE_DELETE_EXPIRED == '') {
		throw "Invalid value for CACHE_DELETE_EXPIRED. Check config.";
	}
} else if (CACHE_ENABLED === undefined ||CACHE_ENABLED == '') {
	throw "Invalid value for ENABLE_KEY_CACHE. Check config.";
}

if (isNaN(TOKEN_LENGTH)) {
	throw "Invalid key length. Check env var is set.";
}

if (!TABLE || TABLE == '') {
	throw "Invalid table name. Check env var is set.";
}

const QUERY_FIELDS = "id, album, TO_BASE64(HEX(value)) AS value, usages_init, usages_left, (usages_init - usages_left) as usages, created";

const queryGetAll = (album) => `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${(album) ? "WHERE album = ?" : ""};`;
const queryGetAllExisting = (album) => `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${(album) ? "WHERE album = ? AND" : "WHERE"} deleted IS FALSE;`;
const queryGetById = () => `SELECT ${QUERY_FIELDS} FROM ${TABLE} WHERE id = ? AND deleted IS FALSE;`;
const queryGetValid = () => `SELECT ${QUERY_FIELDS} FROM ${TABLE} WHERE album = ? AND TO_BASE64(HEX(value)) = ? AND usages_left > 0 AND deleted IS FALSE;`;

const queryNew = () => `INSERT INTO ${TABLE} (album, usages_init, usages_left) VALUES (?, ?, ?);`;
const queryUpdate = (reset) => `UPDATE ${TABLE} SET ${reset ? "usages_init = ?," : ""} usages_left = ? WHERE id = ? AND deleted IS FALSE;`;
const queryDelete = (filter) => `UPDATE ${TABLE} SET deleted = TRUE ${filter ? "WHERE " + filter + " = ? AND" : "WHERE"} deleted IS FALSE;`;

const validateAlbum = (album) => (typeof album == 'string' && album.startsWith('/'));
const validateUsages = (usages) => (typeof usages == 'number' && !isNaN(usages) && usages >= 0);

const keyCache = new NodeCache({
	stdTTL: CACHE_TTL,
	checkperiod: CACHE_PERIOD,
	useClones: CACHE_CLONES,
	deleteOnExpire: CACHE_DELETE_EXPIRED,
});

module.exports.verifyKey = (con, album, key, info, callback, consume = true) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!utils.validateKey(key)) {
		callback("INVALID_KEY", false);
		return;
	}

	if (!validateAlbum(album)) {
		callback("INVALID_ALBUM", false);
		return;
	}

	// If consuming key, we need to query it anyway
	// If cache enabled, and key found in cache and it matches, simply resp auth ok
	if (!consume && CACHE_ENABLED && keyCache.has(key) && keyCache.get(key).value == key) {
		console.debug("Found matching key in cache.");
		callback(null, true);
		return;
	}

	con.query(queryGetValid(), [album, key], (qerr, res) => {
		if (qerr || !res) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		// No keys found with query
		if (res.length <= 0) {
			console.error("Matching key not found.");
			callback("KEY_MATCH_NOT_FOUND", false);
			return;
		}

		// Matches more than one key
		// Should NEVER occur
		if (res.length > 1) {
			console.error("ERROR: Multiple key matches found.");
			callback("KEY_MULTIPLE_MATCHES", false);
			return;
		}

		row = res[0];

		if (CACHE_ENABLED) {
			keyCache.set(row.value, row);
			keyCache.set(row.id, row);
		}

		if (consume) {
			activityManager.addActivity(con, { 'token': row, 'info': info }, (err, ares) => {
				if (err || !ares) {
					console.error("ERROR: Failed to log activity:", err);
				}
			});

			this.updateKey(con, row.id, row.usages_left - 1, (err, ok) => {
				if (err || !ok) {
					console.error(err);
					callback("UPDATE_USAGES_FAILED", false);
					return;
				}

				if (row.value == key) {
					callback(null, true);
					return;
				}

				// This should never occur
				callback("KEY_VERIFICATION_MISMATCH", false);
				return;
			});
			return;
		}

		callback(null, true);
	});
};

module.exports.createKey = (con, album, usages, callback) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!validateAlbum(album)) {
		callback("INVALID_ALBUM", false);
		return;
	}

	if (!validateUsages(usages)) {
		callback("INVALID_USAGES", false);
		return;
	}

	con.query(queryNew(), [album, usages, usages], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		this.getKeys(con, album, callback);
	});
};

module.exports.updateKey = (con, id, usages, callback, reset = false) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!utils.validateId(id)) {
		callback("INVALID_ID", false);
		return;
	}

	if (!validateUsages(usages)) {
		callback("INVALID_USAGES", false);
		return;
	}

	con.query(queryUpdate(reset), reset ? [usages, usages, id] : [usages, id], (qerr, res) => {
		if (qerr || !res) {
			console.error("ERROR: Failed to update key:", qerr);
			callback("UPDATE_FAILED", false);
			return;
		}

		if (res.length <= 0 || res.affectedRows <= 0) {
			console.error("ERROR: Key to update was not found or afftected with ID:", id);
			callback("KEY_NOT_FOUND_OR_AFFECTED", false);
			return;
		}

		callback(null, true);
	});

};

module.exports.deleteKey = (con, id, callback) => {
	if (!con) {
		callback("INVALID_CONNECTION", false);
		return;
	}

	if (!utils.validateId(id)) {
		callback("INVALID_ID", false);
		return;
	}

	con.query(queryDelete('id'), [id], (qerr, res) => {
		if (qerr || !res) {
			console.error(qerr);
			callback("DELETE_FAILED", false);
			return;
		}

		if (res.length <= 0 || res.affectedRows <= 0) {
			console.error("ERROR: Key not found.");
			callback("KEY_NOT_FOUND", false);
			return;
		}

		callback(null, true);
	});
};

module.exports.getKeys = (con, album, callback) => {
	if (!con) {
		callback("INVALID_CONNECTION", false);
		return;
	}

	// album == null => all albums
	// album != null -> validate album value
	if (album != null && !validateAlbum(album)) {
		callback("INVALID_ALBUM", false);
		return;
	}

	con.query(queryGetAllExisting(album), (album == null) ? undefined : [album], (qerr, res) => {
		if (qerr || !res) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		if (res.length <= 0) {
			console.warn("No keys found.");
			callback(null, []);
			return;
		}

		callback(null, res);
	});
};

module.exports.getKey = (con, id, callback) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!utils.validateId(id)) {
		callback("INVALID_ID", false);
		return;
	}

	if (CACHE_ENABLED && keyCache.has(id)) {
		const entry = keyCache.get(id);
		if (entry.id !== id) {
			callback("KEY_CACHE_ID_MISMATCH", false);
			return;
		}
		callback(null, entry);
		return;
	}

	con.query(queryGetById(), [id], (qerr, res) => {
		if (qerr || !res) {
			console.error(qerr);
			callback("GET_TOKEN_FAILED", false);
			return;
		}

		if (res.length <= 0) {
			console.error("ERROR: Key not found.");
			callback("KEY_NOT_FOUND", false);
			return;
		}

		// Should NEVER occur!
		if (res.length > 1) {
			console.error("ERROR: Multiple key matches found.");
			callback("MULTIPLE_KEY_MATCHES", false);
			return;
		}

		row = res[0];

		callback(null, row);
	});
};

module.exports.revokeKey = (con, id, callback) => {
	this.updateKey(con, id, 0, callback);
};

module.exports.writeKeysToFile = (filename, data) => {
	// Prettify data as JSON string
	data = JSON.stringify(data, null, 4);
	fs.writeFile(filename, data, 'utf-8', err => {
		if (err) {
			console.error("Failed to write keys to file:", err);
			throw err;
		} else {
			console.log("Keys written into file: " + filename);
		}
	});
};
