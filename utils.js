mysql = require('mysql');

String.prototype.leftTrim = function() {
    return this.replace(/^\s+/,"");
};

// Defined on DB side
// Depends on the keying method, etc.
const KEY_LENGTH = 32;

const verifyKey = function(con, album, key, callback, consume = true) {
	if (key == null || typeof key != 'string' || key == '' || key.length != KEY_LENGTH) {
		callback("INVALID_KEY", false);
		return;
	}

	const qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token WHERE album = ? AND TO_BASE64(HEX(value)) = ? AND usages > 0;`;
	
	con.query(qry_get, [album, key], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}
		
		// No keys found with query
		if (res.length <= 0) {
			console.error("Mathing key not found.");
			callback("KEY_MATCH_NOT_FOUND", false);
			return;
		}

		if (consume) {
			row = res[0];

			updateKey(con, row.id, row.usages - 1, (err, ok) => {
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

const createKey = function(con, album, usages, callback) {
	if (album == null || typeof album != 'string') {
		callback("INVALID_ALBUM", false);
		return;
	}
	
	if (usages == null || typeof usages != 'number') {
		callback("INVALID_USAGES", false);
		return;
	}

	const qry_new = `INSERT INTO token (album, usages) VALUES (?, ?);`;

	con.query(qry_new, [album, (usages != null && usages >= 0) ? usages : 1], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}

		callback(null, true);
	});
};

const updateKey = function(con, id, usages, callback) {
	if (id == null || typeof id != 'number' || isNaN(id) || id < 0) {
		callback("INVALID_ID", false);
		return;
	}

	if (usages == null || typeof usages != 'number' || usages < 0) {
		callback("INVALID_USAGES", false);
		return;
	}

	const qry_upd = `UPDATE token SET usages = ? WHERE id = ?;`;

	con.query(qry_upd, [usages, id], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback("UPDATE_FAILED", false);
			return;
		}

		callback(null, true);
	});
};

const revokeKey = function(con, id, callback) {
	updateKey(con, id, 0, callback);
};

const deleteKey = function(con, id, callback) {
	if (id == null || typeof id != 'number' || isNaN(id) || id < 0) {
		callback("INVALID_ID", false);
		return;
	}

	const qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token WHERE id = ?;`;
	const qry_del = `DELETE FROM token WHERE id = ?;`;

	con.query(qry_get, [id], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}
		
		if (res.length <= 0) {
			console.error("Key not found.");
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

const getKeys = function(con, album, callback) {
	if (album != null && typeof album != 'string') {
		callback("INVALID_ALBUM", false);
		return;
	}

	var qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token ${(album == null) ? "" : "WHERE album = ?" };`;

	con.query(qry_get, (album == null) ? undefined : [album], (qerr, res) => {
		if (qerr) {
			console.error(qerr);
			callback(qerr, false);
			return;
		}
		
		if (res.length <= 0) {
			console.warning("No keys found.");
			callback(null, []);
			return;
		}

		callback(null, res);
	});
};

const createDbConnection = () => {
	const conn = mysql.createConnection({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PW,
		database: process.env.MYSQL_DB
	});

	conn.connect(cerr => {
		if (cerr) {
			console.error(cerr);
			throw cerr;
		}
	});
	
	return conn;
};

const createDbPool = () => {
	const pool = mysql.createPool({
		connectionLimit: 100,
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PW,
		database: process.env.MYSQL_DB
	});

	return pool;
};

const filterImages = imags => {
	return imags.filter( elem =>
		typeof elem == 'string' && (
		elem.toLowerCase().endsWith('.jpg') ||
		elem.toLowerCase().endsWith('.jpeg') ||
		elem.toLowerCase().endsWith('.png') ||
		elem.toLowerCase().endsWith('.gif') ||
		elem.toLowerCase().endsWith('.tiff')
		)
	);
};

const defaultMeta = () => {
	return {
		"title": "Unknown Album",
		"description": "meta.json was not found within the album."
	};
};

module.exports = {
	String,
	createDbConnection,
	createDbPool,
	filterImages,
	defaultMeta,
	verifyKey,
	getKeys,
	createKey,
	updateKey,
	revokeKey,
	deleteKey
};
