require('dotenv').config({ path: require('find-config')('.env') });

const utils = require('./utils.js');
const fs = require('fs');
const express = require('express');
const mysql = require('mysql');

// Init express
const app = express();
const host = process.env.NODE_HOST;
const port = process.env.NODE_PORT;

const photo_url = "/albums";
const photo_path = __dirname + process.env.PHOTOS_PATH;

// Load static assets
app.use(photo_url, express.static(photo_path));

app.use('/favicon.ico', express.static(__dirname + process.env.FAVICON_PATH));
app.use('/static', express.static(__dirname + process.env.STATIC_DIR))

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

unauthorized = (err, res) => {
	return res
	.status(401).send("Invalid auth key provided." + 
		" Ensure parameter 'key' in the URL is set and is correct." + 
		"<br><br>DEBUG INFO: " + err
		);
}

const con = () => {
	const conn = mysql.createConnection({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PW,
		database: process.env.MYSQL_DB
	});
	
	conn.on('error', err => {
		console.error("Error during DB connection:", err);
	});
	
	return conn;
};

app.get('/', (req, res) => {
	console.log("REQ PATH:", req.path);
	console.log("REQ QUERY:", req.query);

	utils.verifyKey(con(), '/', req.query.key, (err, ok) => {
		if (err || !ok) {
			console.error(err);
			unauthorized(err, res);
		}
		else {
			res.render('index', {
				is_index: true,
				album_url: photo_url,
				albums: fs.readdirSync(photo_path)
			});
		}
	});
});

app.get('/management', (req, res) => {
	console.log("REQ PATH:", req.path);
	console.log("REQ QUERY:", req.query);

	utils.verifyKey(con(), '/management', req.query.key, (err, ok) => {
		if (err || !ok) {
			console.error(err);
			unauthorized(err, res);
		}
		else {
			utils.getKeys(con(), null, (err, data) => {
				if (err || !ok) {
					console.error(err);
					res.status(500).send("Failed to get keys from server.");
				} else {
					// console.log(data);
					res.render('manage', {
						key: req.query.key,
						data
					});						
				}
			});
		}
	});
});

app.post('/management', (req, res) => {
	console.log("REQ PATH:", req.path);
	console.log("REQ QUERY:", req.query);
	console.log("REQ BODY:", req.body);

	utils.verifyKey(con(), '/management', req.body.key, (err, ok) => {
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
						utils.getKeys(con(), data.album, (err, result) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to get keys:" + err);
							} else {
								res.status(200).send(result);
							}
						});
						break;
					case "new":
						utils.createKey(con(), data.album, data.usages, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to add new key: " + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					case "update":
						utils.updateKey(con(), target_id, data.usages, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to modify key:" + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					case "revoke":
						utils.revokeKey(con(), target_id, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to revoke key:" + err);
							} else {
								res.sendStatus(200);
							}
						});
					case "delete":
						utils.deleteKey(con(), target_id, (err, ok) => {
							if (err || !ok) {
								console.error(err);
								res.status(400).send("ERROR: Failed to delete key:" + err);
							} else {
								res.sendStatus(200);
							}
						});
						break;
					default:
						console.error("POST /management: Unknown action request received.");
						res.status(400).send("ERROR: Unknown action request received.");
						break;
				}
			} catch (err) {
				console.error("FAILED TO PROCESS POST:", err);
				res.status(500).send("Caught exception during request processing: " + err);
			}
		}
	});	
});

app.get('*', (req, res) => {
	console.log("REQ PATH:", req.path);
	console.log("REQ QUERY:", req.query);

	const target_url = photo_url + req.path;
	const target_path = photo_path + req.path;

	if (fs.existsSync(target_path)) {
		utils.verifyKey(con(), req.path, req.query.key, (err, ok) => {
			if (err || !ok) {
				console.error(err);
				unauthorized(err, res);
			}
			else {
				const files = fs.readdirSync(target_path);
				const meta = JSON.parse(fs.readFileSync(target_path + "/meta.json"));

				console.log("FILES:", files);
				console.log("META:", meta);

				res.render(process.env.GALLERY_TEMPLATE, {
					is_index: false, 
					gallery_path: target_url, 
					photos: utils.filterImages(files), 
					meta
				});
			}
		});
	} else {
		res.status(404).send("The album you were looking for was not found. Please double check the URL.");
	}
});

app.listen(port, host, () => {
  console.log("Listening at http://" + host + ":" + port)
});
