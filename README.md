# node-lightgallery
Node JS simple implementation for Lightgallery with simple access token management (user interface for managing tokens).

Uses lightgallery (https://github.com/sachinchoolur/lightGallery) for frontend photo management.

# Getting started

## Requirements:
- [Node.js runtime](https://nodejs.org/en/) & [NPM (Node Package Manager)](https://www.npmjs.com/)
- Database server (Currently supported: [MySQL](https://www.mysql.com/))
- 

## Setup instructions (Unix)

Start by cloning this repo:

```bash
git clone https://github.com/sinipelto/node-lightgallery.git ./gallery
```

Get access to a supported database or
(Optional) Install and configure a database system from a supported db provider to a local system (e.g. for local testing).

Ensure that you have access to a database (User and password, DB, a Table with CRUD permissions).

Go to the repository directory:

```bash
cd ./gallery
```

Install required dependencies:

```bash
npm i
```
or
```bash
npm install
```

Configure the environment variables to match your environment:

```bash
cp .env.example .env
nano .env
```

To start right off, just launch the: [`server.js`](server.js):
```bash
node server.js
```
OR with NPM:
```bash
npm start
```

(Optional) Create a service for the application to ensure its running and to get proper logging/journaling:

Create a systemd daemon service for the node application:
```bash
nano node-gallery.service
```

Write and Modify the following to match with your environment:
```text
[Unit]
Description=Service for node.js Lightgallery app
After=network.target
StartLimitIntervalSec=0

[Install]
WantedBy=multi-user.target

[Service]
WorkingDirectory=/path/to/gallery
EnvironmentFile=/path/to/gallery/.env
Type=simple
Restart=always
RestartSec=3
User=USER
ExecStart=/usr/bin/env npm start
```

```
(USER => e.g. root/user with read access to server and gallery directory)
```

Install the service:
```bash
(sudo / root user)
sudo cp node-gallery.service /etc/systemd/system/node-gallery.service
sudo systemctl daemon-reload
```

(Optional) Enable the service on system startup:
```bash
(sudo / root user)
sudo systemctl enable node-gallery
```

Finally, start the service:
```bash
(sudo / root user)
sudo systemctl start node-gallery
```
OR with service:
```bash
(sudo / root user)
sudo service node-gallery start
```

## Usage instructions

Once you have the server up and running correctly, you can set up the albums.

The directory path for the albums is set in the `.env` file. Assuming it to be set to `/path/to/albums`.

Ensure the directory exists:

```bash
dir="/path/to/albums"; [ ! -f "$dir" ] && mkdir "$dir" && echo "Album dir created." || "Album dir exists."
```

Now, add an album to the albums directory. E.g. album `test-album` would be a directory in `/path/to/albums/test-album`

```bash
mkdir /path/to/albums/test-album
```

Now, add some images/photos to the album directory. The image filename doesn't matter.
E.g.:

`/path/to/albums/test-album/img1.png`
`/path/to/albums/test-album/img2.png`
`/path/to/albums/test-album/img3.jpg`
`/path/to/albums/test-album/img4.bmp`

(Optional but highly recommended) You can also add a meta file to add a title and description for the album:
```bash
nano /path/to/albums/test-album/meta.json
```

With a following format:
```json
{
    "title": "My Test Album",
    "description": "This is my test album. You can start the slideshow by clicking one of the photos."
}
```

Next, you need to generate a token for the album to access it through the web server.

First, ensure you have access key to the management page (following example for MySQL):

```sql
USE database;
INSERT INTO TOKEN_TABLE (album, usages) VALUES ('/management', 500);
SELECT album, TO_BASE64(HEX(value)) FROM TOKEN_TABLE WHERE album = '/management' ORDER BY ID DESC LIMIT 1;
```

IN THE FUTURE RELEASES: The initial key for management page is generated on the first launch of the server.
The key resides in the file `tokens.json`. Get the token value from the file:

```bash
cat init-tokens.json
```
```json
[
    {
        "path": "/management",
        "value": "<TOKEN_VALUE>", // EXAMPLE TOKEN
    },
    ...
]
```

The statement can be executed e.g. with the mysql cli:

```bash
mysql -u USER -p -e "<PREVIOUS SQL STATEMENT HERE>"
```

Go to the management page: `http(s)://server-url/management?key=<TOKEN_VALUE>`.

From here you can manage (create, edit, delete, disable) all of the access tokens (including management and index page keys).

Generate a new token for the just created album (see the 'Create new key' section).

The new album is now accessible: `http(s)://server-url/test-album?key=<TOKEN_FOR_THE_ALBUM>`.
