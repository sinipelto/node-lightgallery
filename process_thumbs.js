const utils = require('./utils.js');

const fs = require('fs');
const sharp = require('sharp');

const thumbler = require('video-thumb');

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
			const ext = utils.getFileExtension(val);
			if (utils.imageTypes.includes(ext)) {
				sharp(`${path}/${val}`)
					.resize(width, height)
					.withMetadata() // IMPORTANT!! Preserve Exif, rotation, orientation, etc.
					.toFile(`${thumbPath}/${val}`)
					.then(() => {
						i++;
						if (i >= files.length) console.log("Generating thumbnails done!");
					})
					.catch((error) => {
						console.error("ERROR: Failed while processing thumbnails.");
						console.debug(error);
					});
			} else if (utils.videoTypes.includes(ext)) {
				thumbler.extract(`${path}/${val}`, `${thumbPath}/${val}.png`, '00:00:00', '100x100', (err) => {
					if (err) {
						console.error("ERROR: Unexpected error during thumbnail generation for video.");
						console.debug(err);
					}
				});
			} else {
				console.warn("WARNING: Unknown file type, omitting.");
			}
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
			if (err) {
				console.error("ERROR: Unexpected error during old thumbnails processing:", err);
				throw err;
			}

			if (files.length <= 0) {
				console.log("No previous thumbnails found.");
				createThumbs(path, thumbPath, width, height);
				return;
			}

			console.log("Deleting old thumbnails..");

			for (var i = 0; i < files.length; i++) {
				fs.unlink(`${thumbPath}/${files[i]}`, (erro) => {
					if (erro) {
						console.error("ERROR: Failed to remove old thumbnail:", erro);
						return;
					}
				});
			}

			console.log("Deleting old thumbnails done!");

			createThumbs(path, thumbPath, width, height);
		});
	});
};

module.exports.processThumbnails = (path, width, height) => {
	if (!path) {
		console.error("ERROR: Invalid path provided:", path);
		return;
	}

	width = (width != null && !isNaN(Number(width))) ? Number(width) : undefined;
	height = (height != null && !isNaN(Number(height))) ? Number(height) : undefined;

	fs.exists(path, (ex) => {
		if (!ex) {
			console.error("ERROR: Provided image directory does not exist:", path);
			return;
		}

		const thumbPath = path + '/thumbnails';
		console.log(`Targeting thumbnails directory: ${thumbPath}`);

		fs.exists(thumbPath, (ex) => {
			if (!ex) {
				fs.mkdir(thumbPath, { 'recursive': false, 'mode': 0755 }, (err) => {
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

if (args[2] == "help") {
	printHelp();
	process.exit(0);
}

if (!args[2]) {
	console.error("ERROR: No image path given as argument. Enter the path to the images to generate thumbnails from.");
	printHelp();
	process.exit(1);
}

if (!args[3]) {
	console.warn("WARNING: No target image width for thumbnails given. Using default value.");
	printHelp();
}

if (!args[4]) {
	console.warn("WARNING: No target image height for thumbnails given. Using default value.");
	printHelp();
}

this.processThumbnails(args[2], args[3], args[4]);
