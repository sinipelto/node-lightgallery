USE db;

SELECT * FROM token;

SELECT id, album, TO_BASE64(HEX(value)), usages, created FROM token;

SELECT id, album, TO_BASE64(HEX(value)), usages, created FROM token WHERE usages > 0;
