require('dotenv').config({ path: __dirname + '.env' });

utils = require('../utils.js');
mysql = require('mysql');

const con = mysql.createConnection({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PW,
	database: process.env.MYSQL_DB
});


const path = "/db";
//const key = "";
const key = "";

const verifyKey = function(con, path, key, callback) {
	if (key == null || typeof key != 'string') return false;

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
			
			console.log(res);
			
			if (res.length <= 0) {
				console.log("Matching key not found.");
				callback("NOT_FOUND", false);
			} else {
				row = res[0];
				con.query(qry_upd, [row.usages + 1, row.id], (qerr, res) => {
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

const res = verifyKey(con, path, key, (err, ok) => {
	if (err) console.error("ERROR:", err);
	console.log("VERIFY:", ok);
	process.exit(0);
});

/*
con.connect(err => {
	if (err) {
		console.log(err);
		process.exit(0);
	}
	console.log("CONNECTION OK");
	
	const path = "/test";
	const key = "NDc2RTgwMUQwNTI1NURFODI3OThEMjE2";
	
	const qry_get = `SELECT TO_BASE64(HEX(value)) AS result FROM token WHERE album = '${path}' AND TO_BASE64(HEX(value)) = '${key}' AND usages > 0 ORDER BY id LIMIT 1;`;
	
	console.log(qry_get);
	
	con.query(qry_get, (err, res, fields) => {
		console.log("ERR:", err);
		if (err) {
			console.log(err);
		}
		else {
			console.log("QUERY OK");
			console.log("RES:", res);
			console.log("FIELDS:", fields);
			
			if (res.length <= 0) {
				console.log("EMPTY");
			}
			
			else {
				//buf = res[0].value.toString();
				//console.log(buf.size);
				//console.log(buf.toJSON());

				console.log(res[0].result);
			}
		}
		process.exit(0);
	})
});
*/