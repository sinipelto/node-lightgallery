const utils = require('./utils.js');
const tokenManager = require('./token.js');

const TABLE = process.env.VISIT_TABLE;

if (!TABLE) {
	throw "Invalid table name. Check env var is set.";
}

const QUERY_FIELDS = "id, token_id, INET_NTOA(address) AS address, user_agent, created";

const queryGetAll = (tokenId, limit) => `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${!tokenId ? "" : "WHERE token_id = ?"} ORDER BY created DESC ${!limit ? "" : "LIMIT ?"};`;
const queryNew = (id, address, agent) => `INSERT INTO ${TABLE} (${id ? "token_id," : ""} ${address ? "address," : ""} ${agent ? "user_agent" : ""}) VALUES (${id ? "?," : ""} ${address ? "INET_ATON(?)," : ""} ${agent ? "?" : ""});`;

module.exports.getActivity = (con, tokenId, limit, callback) => {
	if (!con) {
		callback("INVALID_CONNECTION", false);
		return;
	}

	if (!utils.validateId(tokenId)) {
		callback("INVALID_TOKEN_ID", false);
		return;
	}

	if (!utils.validateLimit(limit)) {
		callback("INVALID_LIMIT", false);
		return;
	}

	tokenManager.getKey(con, tokenId, (qerr, tres) => {
		if (qerr || !tres) {
			console.error("ERROR: Failed to get corresponding key for activity:", qerr);
			callback("GET_TOKEN_FAILED", false);
			return;
		}

		con.query(queryGetAll(true, true), [tokenId, limit], (qerr, res) => {
			if (qerr || !res) {
				console.error("ERROR: Failed to get activity data:", qerr);
				callback("GET_VISITS_FAILED", false);
				return;
			}

			if (res.length <= 0) {
				console.warn("No activity found for token id:", tres.id);
				callback(null, []);
				return;
			}

			for (var i = 0; i < res.length; i++) {
				res[i].token = tres;
			}

			callback(null, res);
		});
	});
};

module.exports.addActivity = (con, data, callback) => {
	if (!con) {
		console.error("ERROR: Invalid connection provided.");
		callback("INVALID_CONNECTION", false);
		return;
	}

	if (!utils.validateId(data.token.id)) {
		console.error("ERROR: Invalid token ID provided.");
		callback("INVALID_TOKEN_ID", false);
		return;
	}

	con.query(queryNew(true, true, true), [data.token.id, data.info.address, data.info.userAgent], (qerr, res) => {
		if (qerr || !res) {
			console.error("ERROR: Failed to add new activity entry:", qerr);
			callback(qerr, false);
			return;
		}
	});
};
