const utils = require('./utils');

const fs = require('fs');
const sharp = require('sharp');

const createThumbs = (path, thumbPath, width = 100, height = 100) => {
	fs.readdir(path, (err, files) => {
		if (err) {
			console.error("ERROR: Error reading image files:", err);
			return;
		}

		files = utils.filterMedia(files);

		console.log("Generating thumbnails..");

		var i = 0;
		files.forEach((val) => {
			sharp(`${path}/${val}`)
				.resize(width, height)
				.withMetadata() // IMPORTANT!! Preserve Exif, rotation, orientation, etc.
				.toFile(`${thumbPath}/${val}`)
				.then(() => {
					i++;
					if (i >= files.length) console.log("Generating thumbnails done!");
				})
				.catch((error) => {
					console.error("ERROR: Failed while processing thumbnails:", error);
				});
		});
	});
};

const processThumbs = (path, thumbPath, width, height) => {
	fs.access(thumbPath, fs.constants.R_OK | fs.constants.W_OK, (err) => {
		if (err) {
			console.error("ERROR: Error accessing thumbnails path:", err);
			return;
		}

		fs.readdir(thumbPath, (err, files) => {
			if (files.length <= 0) {
				console.log("No previous thumbnails found.");
				createThumbs(path, thumbPath, width, height);
				return;
			}

			console.log("Deleting old thumbnails..");

			for (var i = 0; i < files.length; i++) {
				fs.unlink(`${thumbPath}/${files[i]}`, (err) => {
					if (err) {
						console.error("ERROR: Failed to remove old thumbnail:", err);
						return;
					}
				});
			}
			createThumbs(path, thumbPath, width, height);
		});
	});
};

module.exports.processThumbnails = (path, width, height) => {
	if (!path) {
		console.error("ERROR: Invalid path provided:", path);
		return;
	}

	fs.exists(path, (ex) => {
		if (!ex) {
			console.error("ERROR: Provided image directory does not exist:", path);
			return;
		}

		const thumbPath = path + '/thumbnails';
		console.log(`Targeting thumbnails directory: ${thumbPath}`);

		fs.exists(thumbPath, (ex) => {
			if (!ex) {
				fs.mkdir(thumbPath, { 'recursive': false, 'mode': 0750 }, (err) => {
					if (err) {
						console.error("ERROR: Failed to create thumbnails directory:", err);
						return;
					}

					console.log("Created thumbnails directory.");
					processThumbs(path, thumbPath, width, height);
					return;
				});
			}

			console.log("Thumbnails dir already exists.");
			processThumbs(path, thumbPath, width, height);
		});
	});
};

// args 0: /path/to/node
// args 1: /path/to/script.js
// args 2: arg 1
// args 3: arg 2
// ...
const args = process.argv;

const printHelp = () => {
	console.log("Usage: node process_thumbs.js <path> <width> <height>");
};

if (!args[2]) {
	console.error("ERROR: No image path given as argument. Enter the path to the images to generate thumbnails from.");
	printHelp();
}

if (!args[3]) {
	console.error("ERROR: No target image width for thumbnails given.");
	printHelp();
}

if (!args[4]) {
	console.error("ERROR: No target image height for thumbnails given.");
	printHelp();
}

this.processThumbnails(args[2], args[3], args[4]);
