String.prototype.leftTrim = () => this.replace(/^\s+/,'');

String.prototype.newLineToHtml = () => this.replace(/(?:\r\n|\r|\n)/g, '<br>');

const filterMedia = imags => {
	return imags.filter( elem =>
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
		"title": "Unknown Album",
		"description": "meta.json was not found within the album."
	};
};

module.exports = {
	String,
	filterMedia,
	defaultMeta,
};
