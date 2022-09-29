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
} else if (CACHE_ENABLED === undefined || CACHE_ENABLED == '') {
	throw "Invalid value for ENABLE_KEY_CACHE. Check config.";
}

if (isNaN(TOKEN_LENGTH)) {
	throw "Invalid key length. Check env var is set.";
}

if (!TABLE || TABLE == '') {
	throw "Invalid table name. Check env var is set.";
}

const QUERY_FIELDS = "id, album, TO_BASE64(HEX(value)) AS value, usages_init, usages_left, (usages_init - usages_left) as usages, created";

const queryGetAll = album => `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${(album) ? "WHERE album = ?" : ""};`;
const queryGetAllExisting = album => `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${(album) ? "WHERE album = ? AND" : "WHERE"} deleted IS FALSE;`;
const queryGetById = () => `SELECT ${QUERY_FIELDS} FROM ${TABLE} WHERE id = ? AND deleted IS FALSE;`;
const queryGetValid = () => `SELECT ${QUERY_FIELDS} FROM ${TABLE} WHERE album = ? AND TO_BASE64(HEX(value)) = ? AND deleted IS FALSE;`;

const queryNew = () => `INSERT INTO ${TABLE} (album, usages_init, usages_left) VALUES (?, ?, ?);`;
const queryUpdate = reset => `UPDATE ${TABLE} SET ${reset ? "usages_init = ?," : ""} usages_left = ? WHERE id = ? AND deleted IS FALSE;`;
const queryDelete = filter => `UPDATE ${TABLE} SET deleted = TRUE ${filter ? "WHERE " + filter + " = ? AND" : "WHERE"} deleted IS FALSE;`;

const keyCache = new NodeCache({
	stdTTL: CACHE_TTL,
	checkperiod: CACHE_PERIOD,
	useClones: CACHE_CLONES,
	deleteOnExpire: CACHE_DELETE_EXPIRED,
});

const updateCache = row => {
	if (CACHE_ENABLED) {
		// Set both value and ID as keys, to match both in later queries
		keyCache.set(row.id, row);
		keyCache.set(row.value, row);
	}
};

const deleteCache = id => {
	if (CACHE_ENABLED) {
		// Remove both ID and value cache entries
		if (keyCache.has(id)) {
			const entry = keyCache.get(id);
			keyCache.del(entry.value);
			keyCache.del(id);
		}
	}
};

module.exports.verifyKey = (con, album, key, userInfo, callback, consume = true) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!utils.validateAlbum(album)) {
		callback("INVALID_ALBUM", false);
		return;
	}

	if (!utils.validateKey(key)) {
		callback("INVALID_KEY", false);
		return;
	}

	var cachedKey = null;
	// If consuming key, we need to query it anyway
	// Token collisions practically impossible => use the validated key as cache key
	// If cache enabled, and token found in cache, matches the album, not incorrect, simply resp auth ok
	// If matching key is invalid, immediate return error => avoid unnecessary DB queries
	// Highly unlikely a key with a value in invalid keys list will be generated within the cache TTL / check interval
	if (CACHE_ENABLED) {
		if (keyCache.has(key)) {
			cachedKey = keyCache.get(key);
			// Key already in cache, is incorrect or does not match this album.
			if (cachedKey.incorrect || cachedKey.album != album) {
				callback("INCORRECT_KEY", false);
				return;
			}
			// Found in cache, not incorrect, has usages left, matches the album
			// If consuming, need to query update etc anyway, otherwise verify keys match
			// If following criteria not fulfilled, needed to fetch up-to-date value from DB
			if (cachedKey.usages_left > 0 && cachedKey.value == key) {
				if (!consume) {
					callback(null, true);
					return;
				}
			} else {
				// For some reason cached key not OK, we need to refresh it
				cachedKey = null;
			}
		}
	}

	// Separate callback for better flow handling
	const handleKey = (qerr, res) => {
		if (qerr || !res) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		// No keys found with query
		if (res.length <= 0) {
			if (CACHE_ENABLED) {
				// Key obj does not exist => create new custom object with requried attributes
				keyCache.set(key, { 'incorrect': true, 'album': album, value: key });
			}
			console.error(`ERROR: Matching key not found. Album: ${album} Key: ${key}`);
			callback("INCORRECT_KEY", false);
			return;
		}

		// Matches more than one key
		// Should NEVER occur
		if (res.length > 1) {
			console.error("ERROR: Multiple key matches found.");
			callback("KEY_MULTIPLE_MATCHES", false);
			return;
		}

		// res = array with 1 element
		row = res[0];

		if (row.usages_left <= 0) {
			console.error("ERROR: Key is depleted, out of usages.");
			callback("KEY_USAGES_DEPLETED", false);
			return;
		}

		// This should never occur
		if (row.value != key) {
			callback("KEY_VERIFICATION_MISMATCH", false);
			return;
		}

		// Create cache entry at this point
		// To ensure subsequent loads use cached value
		updateCache(row);

		// FINAL POINT OF RETURN
		// After this performance does not matter
		callback(null, true);

		if (consume) {
			// Register activity
			activityManager.addActivity(con, { 'token': row, 'info': userInfo }, (err, ares) => {
				if (err || !ares) {
					console.error("ERROR: Failed to log activity:", err);
				}
			});

			// Store new usage to DB
			this.updateKey(con, row.id, row.usages_left - 1, (err, ures) => {
				if (err || !ures) {
					console.error("ERROR: Failed to update key:", err);
				}
				// updateCache called
			});
		}
	};

	if (cachedKey) {
		handleKey(null, [cachedKey]);
	} else {
		con.query(queryGetValid(), [album, key], handleKey);
	}
};

module.exports.createKey = (con, album, usages, callback) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!utils.validateAlbum(album)) {
		callback("INVALID_ALBUM", false);
		return;
	}

	if (!utils.validateUsages(usages)) {
		callback("INVALID_USAGES", false);
		return;
	}

	con.query(queryNew(), [album, usages, usages], (qerr, res) => {
		if (qerr || !res) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		if (res.length <= 0 || res.affectedRows <= 0) {
			console.error("ERROR: Key to update was not found or afftected with ID:", id);
			callback("KEY_ROWS_NOT_AFFECTED", false);
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

	if (!utils.validateUsages(usages)) {
		callback("INVALID_USAGES", false);
		return;
	}

	con.query(queryUpdate(reset), reset ? [usages, usages, id] : [usages, id], (qerr, res) => {
		if (qerr || !res) {
			console.error("ERROR: Failed to update key:", qerr);
			callback(reset ? "KEY_RESET_FAILED" : "KEY_UPDATE_FAILED", false);
			return;
		}

		if (res.length <= 0 || res.affectedRows <= 0) {
			console.error("ERROR: Key to update was not found or afftected with ID:", id);
			callback("KEY_NOT_FOUND_OR_AFFECTED", false);
			return;
		}

		// Ensure cache gets updated on key modification
		this.getKey(con, id, (err, res) => {
			if (err || !res) {
				console.error("ERROR: Failed to update cache:", err);
			}
			// updateCache(row) called
		}, useCache = false);

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

		// Delete key from cache on successful delete
		deleteCache(id);

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
	if (album != null && !utils.validateAlbum(album)) {
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

module.exports.getKey = (con, id, callback, useCache = true) => {
	if (!con) {
		callback("INVALID_OR_BAD_CONNECTION", false);
		return;
	}

	if (!utils.validateId(id)) {
		callback("INVALID_ID", false);
		return;
	}

	if (useCache && CACHE_ENABLED) {
		// If key incorrect, not found by ID
		if (keyCache.has(id)) {
			const entry = keyCache.get(id);
			// Should never occur
			if (entry.id !== id) {
				callback("KEY_CACHE_ID_MISMATCH", false);
				return;
			}
			// Valid key found in cache and verified ok
			callback(null, entry);
			return;
		}
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

		// Ensure cache is updated with the new fetched value
		updateCache(row);

		// Return fetched key to the callback
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
		}
		console.log("Keys written into file: " + filename);
	});
};
