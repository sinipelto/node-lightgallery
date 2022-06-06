const tokenManager = require("./token.js");

const mysql = require('mysql');

// Defined on DB side
// Depends on the keying method, etc.
const TOKEN_LENGTH = Number(process.env.MYSQL_TOKEN_BYTES);
const TOKEN_TABLE = process.env.TOKEN_TABLE;

if (!TOKEN_LENGTH || isNaN(TOKEN_LENGTH)) {
	throw "Invalid key length. Check env var is set.";
}

if (!TOKEN_TABLE) {
	throw "Invalid table name. Check env var is set.";
}

module.exports.createDbConnection = () => {
	const conn = mysql.createConnection({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PW,
		database: process.env.MYSQL_DB
	});

	conn.on('error', err => {
		console.error("Error on mysql connection:", err);
	});

	conn.connect(cerr => {
		if (cerr) {
			console.error(cerr);
			throw cerr;
		}
	});

	return conn;
};

module.exports.createDbPool = () => {
	const pool = mysql.createPool({
		connectionLimit: 100,
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PW,
		database: process.env.MYSQL_DB
	});

	return pool;
};

const createDumpKey = (conn, path) => {
	const fname = "./tokens.json";

	tokenManager.createKey(conn, path, 100, (err, res) => {
		conn.end();

		if (err || !res) {
			console.error("Failed to create initial key:", err);
			throw err;
		}

		console.log("Initial keys created.");

		tokenManager.writeKeysToFile(fname, [{
			"serverPath": res[0].album,
			"keyValue": res[0].value,
			"fullUrl": `http://${process.env.NODE_HOST}:${process.env.NODE_PORT}${res[0].album}?key=${res[0].value}`,
			"usagesLeft": res[0].usages_left,
			"created": res[0].created
		}]);
	});
};

// Initialize the database for the current db provider
module.exports.initDatabase = () => {
	// foreach table in required_tables, do

	// Create table query
	const qry_crt = `CREATE TABLE ${TOKEN_TABLE} (
            id INT UNSIGNED AUTO_INCREMENT UNIQUE PRIMARY KEY,
            value BINARY(${TOKEN_LENGTH}) NOT NULL DEFAULT(RANDOM_BYTES(${TOKEN_LENGTH})),
            album VARCHAR(255) NOT NULL,
            usages INT UNSIGNED NOT NULL DEFAULT(1),
            created DATETIME(4) NOT NULL DEFAULT(NOW(4))
        );`;

	const path = "/management";

	const conn = this.createDbConnection();

	conn.query(qry_crt, (err, res) => {
		// Check if errors
		if (err || !res) {
			// If already exists, already ok
			if (err.errno == 1050) {
				console.log("Token Table already exists. DB is ready. Ensuring keys for management exist..");

				tokenManager.getKeys(conn, path, (err, res) => {
					if (err || !res) {
						conn.end();
						console.error("Failed to retrieve initial key:", err);
						throw err;
					}

					if (res.length <= 0) {
						console.warn("No keys found. Creating key..");
						createDumpKey(conn, path);
						return;
					}

					if (!res.some(key => key.usages > 0)) {
						console.warn("No keys with usages left. Creating key..");
						createDumpKey(conn, path);
						return;
					}

					console.log("Active keys with usages left. No action taken.");
				});

				return;
			}

			console.error("ERROR: Failed to create tokens table:", err);
			throw err;
		}

		// Table was created, no errors
		createDumpKey(conn, path);
	});
};
