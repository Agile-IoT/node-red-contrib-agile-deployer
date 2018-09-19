/*******************************************************************************
* Copyright (c) 2018 Atos, and others
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License 2.0
* which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-2.0/
*
* Contributors:
* Atos - initial implementation
*******************************************************************************/
const d = require('debug')('deployer-client')
const dc = require('./deployer-client')
const os = require('os')


function usage_and_exit() {
    console.log("Usage: deployer-client-cli -a <appname> -k <apikey> [-f <url> -u <url>]");
    console.log("\t-a : application name (must be unique in all Heroku applications space)");
    console.log("\t-k : Heroku API Key");
    console.log("\t-f : URL of zip file with application to deploy (default: https://github.com/node-red/node-red/releases/download/0.18.4/node-red-0.18.4.zip)");
    console.log("\t-u : Unified Deployer URL (default: http://localhost:8002)");
    process.exit(2);
}

if (process.argv.length == 1) {
    usage_and_exit();
}

var currentswitch = "";
var deployerurl = "http://localhost:8002";
var zipurl = "https://github.com/node-red/node-red/releases/download/0.18.4/node-red-0.18.4.zip";
var apikey = "";
var appname = "";

for (i = 1; i < process.argv.length; i++) {
    arg = process.argv[i];
    switch (currentswitch) {
        case "-u":
            deployerurl = arg;
            currentswitch = "";
            break;
        case "-f":
            zipurl = arg;
            currentswitch = "";
            break;
        case "-a":
            appname = arg;
            currentswitch = "";
            break;
        case "-k":
            apikey = arg;
            currentswitch = "";
            break;
        default:
            if (currentswitch == "") {
                if (arg.startsWith("-")) {
                    currentswitch = arg;
                }
                else {
                    /* ignore */
                }
            }
            else {
                usage_and_exit();
            }
    }
}

if (appname == "" || apikey == "") {
    usage_and_exit();
}

console.log(`deployerurl = ${deployerurl}`);
console.log(`zipurl = ${zipurl}`);
console.log(`appname = ${appname}`);


var deployer = dc.Deployer(deployerurl, "heroku", apikey);

deployer.download(zipurl)
.then( (path) => {
    return deployer.deploy(appname, path);
}).then( (out) => {
    console.log(out);
}).catch( (err) => {
    console.error(`Error downloading: ${err}`)
});
