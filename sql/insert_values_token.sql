USE db;

START TRANSACTION;

INSERT INTO token (album, usages) VALUES ('/test-album', 10);
INSERT INTO token (album, usages) VALUES ('/another', 25);
INSERT INTO token (album, usages) VALUES ('/no-usages', 0);

COMMIT;
