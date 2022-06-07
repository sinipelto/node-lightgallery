const tokenManager = require("./token.js");

const mysql = require('mysql');

// Defined on DB side
// Depends on the keying method, etc.
const TOKEN_LENGTH = Number(process.env.MYSQL_TOKEN_BYTES);
const TOKEN_TABLE = process.env.TOKEN_TABLE;
const VISIT_TABLE = process.env.VISIT_TABLE;

if (!TOKEN_LENGTH || isNaN(TOKEN_LENGTH)) {
	throw "Invalid key length. Check env var is set.";
}

if (!TOKEN_TABLE) {
	throw "Invalid table name for token table. Check env var is set.";
}

if (!VISIT_TABLE) {
	throw "Invalid table name for visits table. Check env var is set.";
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
			"usagesInitial": res[0].usages_init,
			"usagesLeft": res[0].usages_left,
			"created": res[0].created
		}]);
	});

};

const createVisitTable = (conn, query) => {
	conn.query(query, (err, res) => {
		if (err || !res) {
			if (err.errno == 1050) {
				console.log("Visits table already exists.");
			} else {
				conn.end();
				console.error("ERROR: Failed to create visits table:", err);
				throw err;
			}
		}
	});
};

const createTokenTable = (conn, path, tokenQuery, visitQuery) => {
	conn.query(tokenQuery, (err, res) => {
		// Check if errors
		if (err || !res) {
			// If already exists, check for initial accessibility e.g. in case of complete lockout
			if (err.errno == 1050) {
				console.log("Token Table already exists. DB is ready. Ensure visit table exists..");

				createVisitTable(conn, visitQuery);

				console.log("Ensuring keys for management exist..");

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

					if (res.every(key => key.usages_left <= 0)) {
						console.warn("No keys with usages_left left. Creating key..");
						createDumpKey(conn, path);
						return;
					}

					conn.end();
					console.log("Active keys with usages left. No action taken.");
				});

				return;
			}

			conn.end();
			console.error("ERROR: Failed to create tokens table:", err);
			throw err;
		}

		// Ensure visit table created
		createVisitTable(conn, visitQuery);

		// Table was created, no errors
		createDumpKey(conn, path);
	});
};

// Initialize the database for the current db provider
module.exports.initDatabase = () => {
	// foreach table in required_tables, do

	// Create table query
	const createToken = `CREATE TABLE ${TOKEN_TABLE} (
		id INT UNSIGNED AUTO_INCREMENT UNIQUE PRIMARY KEY,
		value BINARY(${TOKEN_LENGTH}) NOT NULL DEFAULT(RANDOM_BYTES(${TOKEN_LENGTH})),
		album VARCHAR(255) NOT NULL,
		usages_init INT UNSIGNED NOT NULL DEFAULT(0),
		usages_left INT UNSIGNED NOT NULL DEFAULT(0),
		created DATETIME(4) NOT NULL DEFAULT(NOW(4)),
		deleted BOOLEAN NOT NULL DEFAULT(FALSE)
	);`;

	const createVisit = `CREATE TABLE ${VISIT_TABLE} (
		id INT UNSIGNED AUTO_INCREMENT UNIQUE PRIMARY KEY,
		token_id INT UNSIGNED NOT NULL,
		address INT UNSIGNED NOT NULL,
		created DATETIME(4) NOT NULL DEFAULT(NOW(4)),
		FOREIGN KEY (token_id) REFERENCES ${TOKEN_TABLE}(id)
	);`;

	const path = "/management";

	const conn = this.createDbConnection();

	createTokenTable(conn, path, createToken, createVisit);
};
