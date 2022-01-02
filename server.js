require('dotenv').config({ path: require('find-config')('.env') });

const utils = require('./utils.js');
const fs = require('fs');
const express = require('express');
const pug = require('pug');
const mysql = require('mysql');


const app = express();
const host = process.env.NODE_HOST;
const port = process.env.NODE_PORT;

const photo_url = "/albums";
const photo_path = __dirname + process.env.PHOTOS_PATH;

app.use(photo_url, express.static(photo_path));

app.use('/favicon.ico', express.static(__dirname + process.env.FAVICON_PATH));
app.use('/static', express.static(__dirname + process.env.STATIC_DIR))

app.use('/css', express.static(__dirname + '/node_modules/lightgallery/css'));
app.use('/js', express.static(__dirname + '/node_modules/lightgallery'));
app.use('/plugins', express.static(__dirname + '/node_modules/lightgallery/plugins'));
app.use('/fonts', express.static(__dirname + '/node_modules/lightgallery/fonts'));
app.use('/images', express.static(__dirname + '/node_modules/lightgallery/images'));

app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

unauthorized = res => {
	return res.status(401).send("Invalid auth key provided. Ensure parameter 'key' in the URL is set and is correct.");
}

const con = () => mysql.createConnection({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PW,
	database: process.env.MYSQL_DB
});

app.get('/', (req, res) => {
	console.log("PATH:", req.path);
	console.log("QUERY:", req.query);
	res.sendStatus(404);
});

app.get('*', (req, res) => {
	console.log("REQ PATH:", req.path);
	console.log("REQ QUERY KEY:", req.query.key);

	const target_url = photo_url + req.path;
	const target_path = photo_path + req.path;

	if (fs.existsSync(target_path)) {
		utils.verifyKey(con(), req.path, req.query.key, (err, ok) => {
			if (err || !ok) {
				console.error(err);
				unauthorized(res)
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
