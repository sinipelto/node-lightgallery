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

// Initialize the database for the current db provider
module.exports.initDatabase = (provider) => {
    if (provider == "mysql") {
        // foreach table in required_tables, do

        // Create table query
        const qry_crt = `CREATE TABLE ${TOKEN_TABLE} (
            id INT UNSIGNED AUTO_INCREMENT UNIQUE PRIMARY KEY,
            value BINARY(${TOKEN_LENGTH}) NOT NULL DEFAULT(RANDOM_BYTES(${TOKEN_LENGTH})),
            album VARCHAR(255) NOT NULL,
            usages INT UNSIGNED NOT NULL DEFAULT(1),
            created DATETIME(4) NOT NULL DEFAULT(NOW(4))
        );`;

        const fname = "./tokens.json";
        const path = "/management";

        const conn = this.createDbConnection();

        conn.query(qry_crt, (qerr, res) => {
            conn.end();
            // Check if errors
            if (qerr || !res) {
                // If already exists, already ok
                if (qerr.errno == 1050) {
                    console.log("Token Table already exists. DB is ready.");
                    return;
                }
                console.error("ERROR: Failed to create tokens table:", qerr);
                throw qerr;
            }
            // Table was created, no errors
            else {
                tokenManager.createKey(conn, path, 100, (qerr, res) => {
                    if (qerr || !res) {
                        console.error("Failed to create initial keys:", qerr);
                        throw qerr;
                    } else {
                        console.log("Initial keys created.");
                        tokenManager.writeKeysToFile(fname, [{
                            "path": path,
                            "value": res[0].value
                        }]);
                    }
                });
            }
        });
    }
};
