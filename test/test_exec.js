const utils = require('../utils.js');
const { exec } = require('child_process');

const serviceName = "node-gallery";
const logLineLimit = 50;

exec(`journalctl -u ${serviceName} | tail -${logLineLimit}`, (err, stdout, stderr) => {
	if (err) {
	        console.error("Failed to execute command:", err);
                //res.status(500).send("ERROR: Failed to retrieve logs.");
        } else {
	        //res.send("STDOUT:<br><br>" + stdout.replace("\r\n", "<br>").replace("\n", "<br>").replace("\\n", "<br>") + "<br><br><br><br>" + "STDE>
                //res.send(new Buffer(stdout));
		//console.log(stdout);
		//str = str.replace(/(?:\r\n|\r|\n)/g, '<br>');

		//console.log(stdout.replace(/(?:\r\n|\r|\n)/g, '<br>'));

		console.log(stdout.leftTrim());
		console.log(stdout.newLineToHtml());
        }
});
