require('dotenv').config({ path: require('find-config')('.env') });

const utils = require('../utils.js');

const meta = utils.defaultMeta();

if (!meta || !meta.title || !meta.description) {
    throw "Invalid meta object.";
}
