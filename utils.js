const TOKEN_LENGTH = Number(process.env.TOKEN_LENGTH);

String.prototype.leftTrim = function () { return this.replace(/^\s+/, ''); };

String.prototype.newLineToHtml = function () { return this.replace(/(?:\r\n|\r|\n)/g, '<br>'); };

const imageTypes = [
	'jpg',
	'jpeg',
	'png',
	'gif',
	'bmp',
	'tiff',
	'webp'
];

const videoTypes = [
	'mp4',
	'webm',
	'ogg'
];

const getFileExtension = (filename) => filename.toLowerCase().split('.').pop();

const filterMedia = (imags) => imags.filter(elem => imageTypes.includes(getFileExtension(elem)) || videoTypes.includes(getFileExtension(elem)));

const defaultMeta = () => ({
	"title": "Unnamed Album",
	"description": "Metadata file was not found within the album."
});

const validateId = (id) => (typeof id == 'number' && !isNaN(id) && id >= 0);

const validateLimit = (value) => (typeof value == 'number' && !isNaN(value) && value > 0);

const validateKey = (key) => (typeof key == 'string' && key.length == TOKEN_LENGTH);

const validateAlbum = (album) => (typeof album == 'string' && album.startsWith('/'));

const validateUsages = (usages) => (typeof usages == 'number' && !isNaN(usages) && usages >= 0);

module.exports = {
	String,
	imageTypes,
	videoTypes,
	getFileExtension,
	filterMedia,
	defaultMeta,
	validateId,
	validateLimit,
	validateKey,
	validateAlbum,
	validateUsages,
};
