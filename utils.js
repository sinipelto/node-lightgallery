String.prototype.leftTrim = function() {
    return this.replace(/^\s+/,"");
}


const verifyKey = function(con, path, key, callback) {
	if (key == null || typeof key != 'string') {
		callback("INVALID_KEY", false);
		return;
	}

	const qry_get = `SELECT id, usages, TO_BASE64(HEX(value)) AS result FROM token WHERE album = ? AND TO_BASE64(HEX(value)) = ? AND usages > 0 ORDER BY id LIMIT 1;`;
	const qry_upd = `UPDATE token SET usages = ? WHERE id = ?`;
	
	con.connect(err => {
		if (err) {
			console.error(err);
			callback(err, false);
		}
		con.query(qry_get, [path, key], (qerr, res) => {
			if (qerr) {
				console.error(qerr);
				callback(qerr, false);
			}
			
			if (res.length <= 0) {
				console.log("Mathing key not found.");
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
};

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
	verifyKey,
	filterImages
}
