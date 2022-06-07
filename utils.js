const TOKEN_LENGTH = Number(process.env.TOKEN_LENGTH);

String.prototype.leftTrim = function () { return this.replace(/^\s+/, ''); };

String.prototype.newLineToHtml = function () { return this.replace(/(?:\r\n|\r|\n)/g, '<br>'); };

const filterMedia = imags => {
	return imags.filter(elem =>
		typeof elem == 'string' && (
			elem.toLowerCase().endsWith('.jpg') ||
			elem.toLowerCase().endsWith('.jpeg') ||
			elem.toLowerCase().endsWith('.png') ||
			elem.toLowerCase().endsWith('.gif') ||
			elem.toLowerCase().endsWith('.bmp') ||
			elem.toLowerCase().endsWith('.mp4') ||
			elem.toLowerCase().endsWith('.webm') ||
			elem.toLowerCase().endsWith('.ogg') ||
			elem.toLowerCase().endsWith('.tiff')
		)
	);
};

const defaultMeta = () => {
	return {
		"title": "Unnamed Album",
		"description": "Metadata file was not found within the album."
	};
};

const validateId = (id) => (typeof id == 'number' && !isNaN(id) && id >= 0);

const validateLimit = (value) => (typeof value == 'number' && !isNaN(value) && value > 0);

const validateKey = (key) => (typeof key == 'string' && key.length == TOKEN_LENGTH);

module.exports = {
	String,
	filterMedia,
	defaultMeta,
	validateId,
	validateLimit,
	validateKey,
};
