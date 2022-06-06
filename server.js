require('dotenv').config({ path: require('find-config')('.env') });

const supportedProviders = [
	'mysql'
];

const dbProvider = String(process.env.DATABASE_PROVIDER).toLowerCase();

if (!dbProvider) {
	throw "Invalid database provider. Check env var is set.";
} else if (!supportedProviders.includes(dbProvider)) {
	throw `ERROR: Requested DB provider is not supported at the moment. Supported providers: ${supportedProviders.toString()}`;
}

let dbManager;

if (dbProvider == 'mysql') {
	dbManager = require('./db-mysql.js');
}

const tokenManager = require('./token.js');
const utils = require('./utils.js');

const fs = require('fs');
const express = require('express');
const { exec } = require('child_process');
const requestIp = require('request-ip');

// Init express
const app = express();
const host = process.env.NODE_HOST;
const port = process.env.NODE_PORT;

if (!host || isNaN(port)) {
	throw "Host or port not set. Check env vars are set.";
}

const photoUrl = process.env.PHOTOS_URL;
const photoPath = process.env.PHOTOS_PATH;

if (!photoUrl || !photoPath) {
	throw "Invalid photo url or photo path. Check env vars are set.";
}

const serviceName = process.env.SERVICE_NAME;

if (!serviceName) {
	throw "Invalid service name. Check env var is set.";
}

// Handle the log line limiting
// Hard-coded max limit, overridable by the env var
const defaultLogLineLimit = Number(process.env.LOG_LINE_LIMIT);
const MAX_LOG_LINES = (defaultLogLineLimit > 1000000) ? defaultLogLineLimit : 1000000;

if (isNaN(defaultLogLineLimit) || defaultLogLineLimit <= 0) {
	throw "Invalid log line limit. Check env var is set.";
}

// Init the DB (create tables, etc.) for first use
dbManager.initDatabase(dbProvider);

// Load static assets
app.use('/favicon.ico', express.static(__dirname + process.env.FAVICON_PATH));
app.use('/static', express.static(__dirname + process.env.STATIC_DIR));

app.use('/css', express.static(__dirname + '/node_modules/lightgallery/css'));
app.use('/js', express.static(__dirname + '/node_modules/lightgallery'));
app.use('/plugins', express.static(__dirname + '/node_modules/lightgallery/plugins'));
app.use('/fonts', express.static(__dirname + '/node_modules/lightgallery/fonts'));
app.use('/images', express.static(__dirname + '/node_modules/lightgallery/images'));

// PUG View engine middleware
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

// HTTP Body JSON parser middleware
app.use(express.json());

// Middleware for handling request ip
app.use(requestIp.mw());

// Define a generic way of responding to unauthorized requests
const unauthorized = (err, res) => {
	return res
		.status(401)
		.send("Invalid auth key provided." +
			" Ensure parameter 'key' in the URL is set and is correct." +
			"<br><br>DEBUG INFO: " + err
		);
};

// Initiate a DB connection pool for accessing the DB consistently & reliably
const dbPool = dbManager.createDbPool();

const route_root = '/';
const route_logs = '/logs';
const route_management = '/management';

app.get(route_root, (req, res) => {
	console.info(`GET ${req.path} [${req.clientIp}]`);
	console.log("REQ QUERY:", req.query);
	console.log("REQ PARAMS:", req.params);

	tokenManager.verifyKey(dbPool, route_root, req.query.key, (err, ok) => {
		if (err || !ok) {
			console.error(err);
			unauthorized(err, res);
		}
		else {
			res.render('index', {
				is_index: true,
				album_url: photoUrl,
				albums: fs.readdirSync(photoPath)
			});
		}
	});
});

app.get(route_logs, (req, res) => {
	console.info(`GET ${req.path} [${req.clientIp}]`);
	console.log("REQ QUERY:", req.query);
	console.log("REQ PARAMS:", req.params);

	tokenManager.verifyKey(dbPool, route_logs, req.query.key, (err, ok) => {
		if (err || !ok) {
			console.error(err);
			unauthorized(err, res);
		}
		else {
			try {
				const limitNum = (req.query.limit != null) ? Number(req.query.limit) : NaN;
				const limit = (limitNum != null && !isNaN(limitNum) && limitNum > 0 && limitNum <= MAX_LOG_LINES) ? limitNum : Number(defaultLogLineLimit);

				exec(`journalctl -u ${serviceName} | tail -${limit}`, (err, stdout, stderr) => {
					if (err) {
						console.error("Failed to execute command:", err);
						res.status(500).send("ERROR: Failed to retrieve logs.");
					} else {
						res.send("STDOUT:<br><br>" + stdout.newLineToHtml() + "<br><br><br>" + "STDERR:<br><br>" + stderr.newLineToHtml());
					}
				});
			} catch (cerr) {
				console.error("Failed to retrieve logs:", cerr);
				res.status(500).send("ERROR: Failed to retrieve logs.");
			}
		}
	});
});

app.get(route_management, (req, res) => {
	console.info(`GET ${req.path} [${req.clientIp}]`);
	console.log("REQ QUERY:", req.query);
	console.log("REQ PARAMS:", req.params);

	tokenManager.verifyKey(dbPool, route_management, req.query.key, (err, ok) => {
		if (err || !ok) {
			console.error(err);
			unauthorized(err, res);
		}
		else {
			tokenManager.getKeys(dbPool, null, (err, data) => {
				if (err || !data) {
					console.error(err);
					res.status(500).send("Failed to get keys from server.");
				} else {
					res.render('manage', {
						key: req.query.key,
						data
					});
				}
			});
		}
	});
});

app.post(route_management, (req, res) => {
	console.info(`POST ${req.path} [${req.clientIp}]`);
	console.log("REQ QUERY:", req.query);
	console.log("REQ PARAMS:", req.params);
	console.log("REQ BODY:", req.body);

	tokenManager.verifyKey(dbPool, route_management, req.body.key, (err, ok) => {
		if (err || !ok) {
			console.error(err);
			unauthorized(err, res);
		}
		else {
			try {
				action = req.body.action;
				target_id = req.body.target_id;
				data = req.body.data;

				switch (action) {
					case "get":
						tokenManager.getKeys(dbPool, data.album, (err, result) => {
							if (err || !result) {
								console.error(err);
								res.status(400).send("ERROR: Failed to get keys:" + err);
							} else {
								res.status(200).send(result);
							}
						});
						break;
					case "new":
						tokenManager.createKey(dbPool, data.album, data.usages, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to add new key: " + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					case "update":
						tokenManager.updateKey(dbPool, target_id, data.usages, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to modify key:" + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					case "revoke":
						tokenManager.revokeKey(dbPool, target_id, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to revoke key:" + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					case "delete":
						tokenManager.deleteKey(dbPool, target_id, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to delete key:" + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					default:
						console.error(`POST ${route_management}: Unknown action request received.`);
						res.status(400).send("ERROR: Unknown action request received.");
						break;
				}
			} catch (cerr) {
				console.error("FAILED TO PROCESS POST:", cerr);
				res.status(500).send("Caught exception during request processing: " + cerr);
			}
		}
	});
});

app.get(photoUrl + '/*' + '/:photo', (req, res) => {
	// Log flood
	// console.info(`GET ${req.path} [${req.clientIp}]`);
	// console.log("REQ QUERY:", req.query);
	// console.log("REQ PARAMS:", req.params);

	const album_url = '/' + req.params['0'];
	const file_url = '/' + req.params.photo;
	const photo_file = photoPath + album_url + file_url;

	// We can first verify the key since it does NOT consume in here
	tokenManager.verifyKey(dbPool, album_url, req.query.key, (err, ok) => {
		if (err || !ok) {
			console.error(`FAILED TO GET ${req.path} [${req.clientIp}]`);
			console.error(err);
			unauthorized(err, res);
		}
		else {
			fs.exists(photo_file, e => {
				if (e) {
					res.sendFile(photo_file);
				} else {
					console.error(`FAILED TO GET ${req.path} [${req.clientIp}]`);
					res.status(404).send("Requested photo was not found.");
				}
			});
		}
	}, false);
});

app.get('/:url', (req, res) => {
	console.info(`GET ${req.path} [${req.clientIp}]`);
	console.log("REQ QUERY:", req.query);
	console.log("REQ PARAMS:", req.params);

	const url = '/' + req.params.url;
	const target_url = photoUrl + url;
	const target_path = photoPath + url;

	fs.exists(target_path, e => {
		if (e) {
			tokenManager.verifyKey(dbPool, url, req.query.key, (err, ok) => {
				if (err || !ok) {
					console.error(err);
					unauthorized(err, res);
					return;
				}

				fs.readdir(target_path, (err, files) => {
					if (err) {
						console.error("Failed to process album files:", err);
						res.sendStatus(500);
						return;
					}

					fs.readFile(target_path + "/meta.json", (err, file) => {
						var meta;

						// Try to read meta.json
						// If read fails, or file is malformed, fallback to default meta
						try {
							if (err) {
								console.error("Failed to read album META:", err);
								throw err;
							} else {
								meta = JSON.parse(file);
							}
						} catch (error) {
							meta = utils.defaultMeta();
						}

						res.render('gallery', {
							is_index: false,
							gallery_path: target_url,
							photos: utils.filterMedia(files),
							key: req.query.key,
							meta
						});
					});
				});
			});
		} else {
			res.status(404).send("The album you were looking for was not found. Please double check the URL.");
		}
	});
});

app.get("*", (req, res) => {
	console.info(`GET ${req.path} [FROM: ${req.clientIp}]`);
	console.log("REQ QUERY:", req.query);
	console.log("REQ PARAMS:", req.params);

	res.status(404).send("Page not found.");
});

app.listen(port, host, () => {
	console.info("Server started.");
	console.log("Listening at http://" + host + ':' + port);
});
