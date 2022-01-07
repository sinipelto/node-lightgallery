const tokenManager = require("./token.js");

const mysql = require('mysql');

// Defined on DB side
// Depends on the keying method, etc.
const TOKEN_LENGTH = Number(process.env.MYSQL_TOKEN_BYTES);
const TABLE = process.env.TOKEN_TABLE;

if (!TOKEN_LENGTH || isNaN(TOKEN_LENGTH)) {
    throw "Invalid key length. Check env var is set.";
}

if (!TABLE) {
    throw "Invalid table name. Check env var is set.";
}

module.exports.createDbConnection = () => {
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

// Initialize the database for the current db provider
module.exports.initDatabaseAsync = (provider) => {
    if (provider == "mysql") {
        const qry_crt = `CREATE TABLE IF NOT EXISTS ${TABLE} (
            id INT UNSIGNED AUTO_INCREMENT UNIQUE PRIMARY KEY,
            value BINARY(${TOKEN_LENGTH}) NOT NULL DEFAULT(RANDOM_BYTES(${TOKEN_LENGTH})),
            album VARCHAR(255) NOT NULL,
            usages INT UNSIGNED NOT NULL DEFAULT(1),
            created DATETIME(4) NOT NULL DEFAULT(NOW(4))
        );`;

        const qry_get = `SELECT album, TO_BASE64(HEX(value)) as value FROM ${TABLE} WHERE album = ? AND USAGES > 0 ORDER BY created DESC LIMIT 1;`;
        const qry_ins = `INSERT INTO ${TABLE} (album, usages) VALUES ('?', ?);`;

        const fname = "./tokens.json";
        const path = "/management";

        const conn = this.createDbConnection();

        conn.query(qry_crt, (qerr, res) => {
            if (qerr || !res) {
                console.error("ERROR: Failed to create tokens table:", qerr);
                throw qerr;
            } else {
                tokenManager.getKeys(conn, path, (qerr, tokens) => {
                    if (qerr || tokens.length <= 0) {
                        console.error("No management keys available. Trying to create..");
        
                        tokenManager.createKey(conn, path, 100, (qerr, res) => {
                            if (qerr || !res) {
                                console.error("Failed to create initial keys.");
                                throw qerr;
                            } else {
                                console.log("Initial keys created.");
        
                                writeKeysToFile("./tokens.json", [{
                                    "path": "/management",
                                    "token": res[0].value
                                }]);
                            }
                        });
                    } else {
                        tokenManager.writeKeysToFile(fname, {
                            "path": path,
                            "token": tokens[0]
                        });
                    }
                });
            }
        });

        conn.query(qry_get, ['/management'], (qerr, res) => {
            if (qerr || res.length <= 0) {
                console.error("No management keys available. Trying to create..");


                conn.query(qry_ins, ['/management', 100], (qerr, res) => {
                    if (qerr) {
                        console.error("Failed to create initial keys.");
                        throw qerr;
                    } else {
                        writeKeysToFile("./tokens.json", [{
                            "path": "/management",
                            "token": res[0].value
                        }]);
                    }
                });
            } else {
                writeKeysToFile("./tokens.json", [{
                    "path": "/management",
                    "token": res[0].value
                }]);
            }
        });
    }
};
