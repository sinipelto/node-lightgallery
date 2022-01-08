const fs = require('fs');

const QUERY_FIELDS = "id, album, TO_BASE64(HEX(value)) AS value, usages, created";
const TOKEN_LENGTH = Number(process.env.TOKEN_LENGTH);
const TABLE = process.env.TOKEN_TABLE;

if (!TOKEN_LENGTH || isNaN(TOKEN_LENGTH)) {
    throw "Invalid key length. Check env var is set.";
}

if (!TABLE) {
    throw "Invalid table name. Check env var is set.";
}

const validateKey = (key) => !(!key || typeof key != 'string' || key == '' || key.length != TOKEN_LENGTH);
const validateAlbum = (album) => !(!album || typeof album != 'string' || !album.startsWith('/'));
const validateId = (id) => !(!id || typeof id != 'number' || isNaN(id) || id < 0);
const validateUsages = (usages) => !(!usages || typeof usages != 'number' || isNaN(usages) || usages < 0);

module.exports.verifyKey = (con, album, key, callback, consume = true) => {
	if (!con) {
		callback("INVALID_CONNECTION", false);
		return;
	}

	if (!validateKey(key)) {
		callback("INVALID_KEY", false);
		return;
	}

	 if(!validateAlbum(album)) {
		 callback("INVALID_ALBUM", false);
		 return;
	 }

	const qry_get = `SELECT ${QUERY_FIELDS} FROM ${TABLE} WHERE album = ? AND TO_BASE64(HEX(value)) = ? AND usages > 0;`;
	
	con.query(qry_get, [album, key], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}
		
		// No keys found with query
		if (!res || res.length <= 0) {
			console.error("Mathing key not found.");
			callback("KEY_MATCH_NOT_FOUND", false);
			return;
		}

		if (consume) {
			row = res[0];

			this.updateKey(con, row.id, row.usages - 1, (err, ok) => {
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
		callback("INVALID_CONNECTION", false);
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

	const qry_new = `INSERT INTO ${TABLE} (album, usages) VALUES (?, ?);`;

	con.query(qry_new, [album, (usages != null && usages >= 0) ? usages : 1], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		this.getKeys(con, album, callback);
	});
};

module.exports.updateKey = (con, id, usages, callback) => {
	if (!con) {
		callback("INVALID_CONNECTION", false);
		return;
	}

	if (!validateId(id)) {
		callback("INVALID_ID", false);
		return;
	}

	if (!validateUsages(usages)) {
		callback("INVALID_USAGES", false);
		return;
	}

	const qry_upd = `UPDATE ${TABLE} SET usages = ? WHERE id = ?;`;

	con.query(qry_upd, [usages, id], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback("UPDATE_FAILED", false);
			return;
		}

		if (!res || res.length <= 0) {
			console.error("ERROR: Key to update was not found with ID " + id);
			callback("KEY_NOT_FOUND", false);
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

	if (!validateId(id)) {
		callback("INVALID_ID", false);
		return;
	}

	const qry_get = `SELECT ${QUERY_FIELDS} FROM ${TABLE} WHERE id = ?;`;
	const qry_del = `DELETE FROM ${TABLE} WHERE id = ?;`;

	con.query(qry_get, [id], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}
		
		if (!res || res.length <= 0) {
			console.error("ERROR: Key not found.");
			callback("KEY_NOT_FOUND", false);
			return;
		} 

		row = res[0];

		con.query(qry_del, [row.id], (qerr, res) => {
			if (qerr) {
				console.error(qerr);
				callback("DELETE_FAILED", false);
				return;
				
			}

			callback(null, true);
		});
	});
};

module.exports.getKeys = (con, album, callback) => {
	if (!con) {
		callback("INVALID_CONNECTION", false);
		return;
	}

	// album == null => all albums
	// album != null -> validate
	if (album != null && !validateAlbum(album)) {
		callback("INVALID_ALBUM", false);
		return;
	}

	var qry_get = `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${(album == null) ? "" : "WHERE album = ?" };`;

	con.query(qry_get, (album == null) ? undefined : [album], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}
		
		if (!res || res.length <= 0) {
			console.warn("No keys found.");
			callback(null, []);
			return;
		}

		callback(null, res);
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