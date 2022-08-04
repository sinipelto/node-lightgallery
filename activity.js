const utils = require('./utils.js');
const tokenManager = require('./token.js');
const { response } = require('express');
const res = require('express/lib/response');

const QUERY_FIELDS = "id, token_id, INET_NTOA(address) AS address, created";

const TABLE = process.env.VISIT_TABLE;

if (!TABLE) {
	throw "Invalid table name. Check env var is set.";
}

const queryGetAll = (tokenId, limit) => `SELECT ${QUERY_FIELDS} FROM ${TABLE} ${!tokenId ? "" : "WHERE token_id = ?"} ORDER BY created DESC ${!limit ? "" : " LIMIT ?"};`;
const queryNew = () => `INSERT INTO ${TABLE} (token_id, address) VALUES (?, INET_ATON(?));`;

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

	con.query(queryNew(), [data.token.id, data.info.address], (qerr, res) => {
		if (qerr || !res) {
			console.error("ERROR: Failed to add new activity entry:", qerr);
			callback(qerr, false);
			return;
		}
	});
};
