String.prototype.leftTrim = function() {
    return this.replace(/^\s+/,"");
}

// Defined on DB side
// Depends on the keying method, etc.
const KEY_LENGTH = 32;

const verifyKey = function(con, album, key, callback) {
	if (key == null || typeof key != 'string' || key == '' || key.length != KEY_LENGTH) {
		callback("INVALID_KEY", false);
		return;
	}

	const qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token WHERE album = ? AND TO_BASE64(HEX(value)) = ? AND usages > 0;`;
	const qry_upd = `UPDATE token SET usages = ? WHERE id = ?;`;
	
	try {
		con.connect(err => {
			if (err) {
				console.error(err);
				callback(err, false);
			}

			con.query(qry_get, [album, key], (qerr, res) => {
				if (qerr) {
					console.error(qerr);
					callback(qerr, false);
				}
				
				if (res.length <= 0) {
					console.error("Mathing key not found.");
					callback("KEY_MATCH_NOT_FOUND", false);
				} else {
					row = res[0];
					con.query(qry_upd, [row.usages - 1, row.id], (qerr, res) => {
						if (qerr) {
							console.error(qerr);
							callback("UPDATE_USAGES_FAILED", false);
						} else if (row.value == key) {
							callback(null, true);
						} else {
							// This should never occur
							callback("KEY_VERIFICATION_MISMATCH", false);
						}
					});
				}
			});
		});
	} catch (err) {
		console.error("Caught exception:", err);
		callback(err, false);
	}
}

const createKey = function(con, album, usages, callback) {
	if (album == null || typeof album != 'string') {
		callback("INVALID_ALBUM", false);
		return;
	}
	
	if (usages == null || typeof usages != 'number') {
		callback("INVALID_USAGES", false);
		return;
	}
	
	const qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token WHERE ID = ?;`;
	const qry_new = `INSERT INTO token (album, usages) VALUES (?, ?);`;
	
	con.connect(err => {
		if (err) {
			console.error(err);
			callback(err, false);
		}

		con.query(qry_new, [album, (usages != null && usages >= 0) ? usages : 1], (qerr, res) => {
			if (qerr) {
				console.error(qerr);
				callback(qerr, false);
			}
			
			con.query(qry_get, [res.insertId], (qerr, res) => {
				if (qerr) {
					console.error(qerr);
					callback("GET_NEW_KEY_FAILED", false);
				}
				if (res.length <= 0) {
					console.error("Mathing key not found.");
					callback("NEW_KEY_NOT_FOUND", false);
				} else {
					callback(null, true);
				}
			});
		});
	});
}

const updateKey = function(con, id, usages, callback) {
	if (id == null || typeof id != 'number' || isNaN(id) || id < 0) {
		callback("INVALID_ID", false);
		return;
	}

	if (usages == null || typeof usages != 'number' || usages < 0) {
		callback("INVALID_USAGES", false);
		return;
	}

	const qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token WHERE id = ?;`;
	const qry_upd = `UPDATE token SET usages = ? WHERE id = ?;`;
	
	con.connect(err => {
		if (err) {
			console.error(err);
			callback(err, false);
		}
		con.query(qry_get, [id], (qerr, res) => {
			if (qerr) {
				console.error(qerr);
				callback(qerr, false);
			}
			
			if (res.length <= 0) {
				console.error("Mathing key not found.");
				callback("NOT_FOUND", false);
			} else {
				row = res[0];
				con.query(qry_upd, [row.usages - 1, row.id], (qerr, res) => {
					if (qerr) {
						console.error(qerr);
						callback("UPDATE_FAILED", false);
						
					} else {
						callback(null, true);
					}
				});
			}
		});
	});
}

const revokeKey = function(con, id, callback) {
	updateKey(con, id, 0, callback);
}

const deleteKey = function(con, id, callback) {
	if (id == null || typeof id != 'number' || isNaN(id) || id < 0) {
		callback("INVALID_ID", false);
		return;
	}

	const qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token WHERE id = ?;`;
	const qry_del = `DELETE FROM token WHERE id = ?;`;
	
	con.connect(err => {
		if (err) {
			console.error(err);
			callback(err, false);
		}
		con.query(qry_get, [id], (qerr, res) => {
			if (qerr) {
				console.error(qerr);
				callback(qerr, false);
			}
			
			if (res.length <= 0) {
				console.error("Key not found.");
				callback("KEY_NOT_FOUND", false);
			} else {
				row = res[0];
				con.query(qry_del, [row.id], (qerr, res) => {
					if (qerr) {
						console.error(qerr);
						callback("DELETE_FAILED", false);
						
					} else {
						callback(null, true);
					}
				});
			}
		});
	});
}

const getKeys = function(con, album, callback) {
	if (album != null && typeof album != 'string') {
		callback("INVALID_ALBUM", false);
		return;
	}

	var qry_get = `SELECT id, album, TO_BASE64(HEX(value)) AS value, usages, created FROM token ${(album == null) ? "" : "WHERE album = ?" };`;

	con.connect(err => {
		if (err) {
			console.error(err);
			callback(err, false);
		}

		con.query(qry_get, (album == null) ? undefined : [album], (qerr, res) => {
			if (qerr) {
				console.error(qerr);
				callback(qerr, false);
			}
			
			if (res.length <= 0) {
				console.warning("No keys found.");
				callback(null, []);
			} else {
				callback(null, res);
			}
		});
	});}

filterImages = function(imags) {
	return imags.filter( elem =>
		typeof elem == 'string' && (
		elem.toLowerCase().endsWith('.jpg') ||
		elem.toLowerCase().endsWith('.jpeg') ||
		elem.toLowerCase().endsWith('.png') ||
		elem.toLowerCase().endsWith('.gif') ||
		elem.toLowerCase().endsWith('.tiff')
		)
	);
}

module.exports = {
	String,
	filterImages,
	verifyKey,
	getKeys,
	createKey,
	revokeKey,
	updateKey,
}
