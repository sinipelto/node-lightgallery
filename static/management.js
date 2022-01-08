var errorIdUpdate;
var errorUsageUpdate;

var inputIdUpdate;
var inputUsageUpdate;

var errorAlbumCreate;
var errorUsageCreate;

var inputAlbumCreate;
var inputUsageCreate;

var errorBanner;
var errorBannerText;

var revokeKey;
var updateKey;
var createKey;
var deleteKey;

$(document).ready(() => {
    errorIdUpdate = document.getElementById('errorIdUpdate');
    errorUsageUpdate = document.getElementById('errorUsageUpdate');

    inputIdUpdate = document.getElementById('keyIdUpdate');
    inputUsageUpdate = document.getElementById('keyUsageUpdate');

    errorAlbumCreate = document.getElementById('errorAlbumCreate');
    errorUsageCreate = document.getElementById('errorUsageCreate');

    inputAlbumCreate = document.getElementById('keyAlbumCreate');
    inputUsageCreate = document.getElementById('keyUsageCreate');

    errorBanner = $('#errorMsg');
    errorBannerText = $('#errorMsgText');

    errorBanner.on("close.bs.alert", () => {
        errorBanner.hide();
        return false;
    });

    const respHandler = async (res) => {
        if (!res.ok) {
            console.error("RESPONSE NOT OK:", res);
            errorBannerText.text(`ERROR: Operation failed. Code: ${res.status} (${res.statusText}) Message: ${await res.text()}`);
            errorBanner.show();
            return;
        }
        location.reload();
    };

    const catchHandler = (err) => {
        console.error("ERROR during fetch request:", err);
    };

    revokeKey = id => {
        console.log("REVOKE KEY CALLED.");

        fetch("/management", {
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify({
                    'key': AUTH_KEY,
                    'action': 'revoke',
                    'target_id': id
                })
            })
            .then(respHandler)
            .catch(catchHandler);
    };

    deleteKey = id => {
        console.log("DELETE KEY CALLED.");

        fetch("/management", {
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify({
                    'key': AUTH_KEY,
                    'action': 'delete',
                    'target_id': id
                })
            })
            .then(respHandler)
            .catch(catchHandler);
    };

    updateKey = () => {
        console.log("UPDATE KEY CALLED.");

        // Clear old error messages
        errorIdUpdate.innerText = "";
        errorUsageUpdate.innerText = "";

        if (inputIdUpdate == null || inputIdUpdate.value == null) {
            const err = "Could not read ID input!";
            errorIdUpdate.innerText = err;
            throw err;
        }

        if (inputUsageUpdate == null || inputUsageUpdate.value == null) {
            const err = "Could not read usage count input!";
            errorUsageUpdate.innerText = err;
            throw err;
        }

        if (typeof inputIdUpdate.value != 'string' || inputIdUpdate.value == '') {
            const err = "Invalid or empty value for ID!";
            errorIdUpdate.innerText = err;
            throw err;
        }

        if (typeof inputUsageUpdate.value != 'string' || inputUsageUpdate.value == '') {
            const err = "Invalid or empty value for usage count!";
            errorUsageUpdate.innerText = err;
            throw err;
        }

        if (isNaN(inputIdUpdate.value)) {
            const err = "ID must be a number!";
            errorIdUpdate.innerText = err;
            throw err;
        } else if (inputIdUpdate.value < 0) {
            const err = "ID must have value greater than or equal to zero (>= 0)!";
            errorIdUpdate.innerText = err;
            throw err;
        }

        if (isNaN(inputUsageUpdate.value)) {
            const err = "Usage count must be a number!";
            errorUsageUpdate.innerText = err;
            throw err;
        } else if (inputUsageUpdate.value < 0) {
            const err = "Usage count must have value greater than or equal to zero (>= 0)!";
            errorUsageUpdate.innerText = err;
            throw err;
        }

        console.log("ID:", inputIdUpdate.value);
        console.log("USAGE:", inputUsageUpdate.value);

        fetch("/management", {
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify({
                    'key': AUTH_KEY,
                    'action': 'update',
                    'target_id': Number(inputIdUpdate.value),
                    'data': {
                        'usages': Number(inputUsageUpdate.value)
                    }
                })
            })
            .then(respHandler)
            .catch(catchHandler);
    };

    createKey = () => {
        console.log("CREATE KEY CALLED.");

        // Clear old error messages
        errorAlbumCreate.innerText = "";
        errorUsageCreate.innerText = "";

        if (inputAlbumCreate == null || inputAlbumCreate.value == null) {
            const err = "Could not read album name input!";
            errorAlbumCreate.innerText = err;
            throw err;
        }

        if (inputUsageCreate == null || inputUsageCreate.value == null) {
            const err = "Could not read usage count input!";
            errorUsageCreate.innerText = err;
            throw err;
        }

        if (typeof inputAlbumCreate.value != 'string' || inputAlbumCreate.value == '') {
            const err = "Invalid or empty value for album name!";
            errorAlbumCreate.innerText = err;
            throw err;
        }

        if (typeof inputUsageCreate.value != 'string' || inputUsageCreate.value == '') {
            const err = "Invalid or empty value for usage count!";
            errorUsageCreate.innerText = err;
            throw err;
        }

        if (isNaN(inputUsageCreate.value)) {
            const err = "Usage count must be a number!";
            errorUsageCreate.innerText = err;
            throw err;
        } else if (inputUsageCreate.value < 0) {
            const err = "Usage count must have value greater than or equal to zero (>= 0)!";
            errorUsageCreate.innerText = err;
            throw err;
        }

        console.log("ALBUM:", inputAlbumCreate.value);
        console.log("USAGE:", inputUsageCreate.value);

        fetch("/management", {
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify({
                    'key': AUTH_KEY,
                    'action': 'new',
                    'data': {
                        'album': (inputAlbumCreate.value.startsWith('/')) ? inputAlbumCreate.value : '/' + inputAlbumCreate.value,
                        'usages': Number(inputUsageCreate.value)
                    }
                })
            })
            .then(respHandler)
            .catch(catchHandler);
        };
        });
