require('dotenv').config({ path: require('find-config')('.env') });

const utils = require('../utils.js');
const db = require('../db.js');
const tokenManager = require('../token.js');

const validateUsages = (usages) => usages && typeof usages == 'number' && !isNaN(usages) && usages >= 0;

// console.log(isNaN('sadjk'));
// console.log(validateUsages(0));

// const usages = 0;

// console.log(typeof usages == 'number' && !isNaN(usages) && usages >= 0);

// console.log(usages && typeof usages == 'number');

// console.log(usages);
// console.log(typeof usages == 'number');
// console.log(!isNaN(usages));
// console.log(usages >= 0);

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
