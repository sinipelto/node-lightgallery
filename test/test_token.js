require('dotenv').config({ path: require('find-config')('.env') });

const utils = require('../utils.js');
const db = require('../db.js');
const tokenManager = require('../token.js');

const validateUsages = (usages_left) => usages_left && typeof usages_left == 'number' && !isNaN(usages_left) && usages_left >= 0;

// console.log(isNaN('sadjk'));
// console.log(validateUsages(0));

// const usages_left = 0;

// console.log(typeof usages_left == 'number' && !isNaN(usages_left) && usages_left >= 0);

// console.log(usages_left && typeof usages_left == 'number');

// console.log(usages_left);
// console.log(typeof usages_left == 'number');
// console.log(!isNaN(usages_left));
// console.log(usages_left >= 0);

// console.log(isNaN(undefined));

const pool = db.createDbPool();

tokenManager.getKeys(pool, null, (err, res) => {
    console.log(err);
    console.log(res);

    // tokenManager.createKey(pool, "/management", 500);

    tokenManager.updateKey(pool, 1, 500, (err, res) => {
        console.log(err);
        console.log(res);

        process.exit(0);
    });
});
