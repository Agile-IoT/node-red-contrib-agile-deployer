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
var d = require('debug')('flow-pusher')
var p = require('./flow-pusher')

function usage_and_exit() {
    console.log("Usage: flow-pusher -s <url> -t <url> -l <tab label> [-u <user> -p <pwd>]");
    process.exit(2);
}

if (process.argv.length == 1) {
    usage_and_exit();
}

var currentswitch = "";
var sourceurl = "";
var targeturl = "";
var label = "";
var user, password;

for (i = 1; i < process.argv.length; i++) {
    arg = process.argv[i];
    switch (currentswitch) {
        case "-s":
            sourceurl = arg;
            currentswitch = "";
            break;
        case "-t":
            targeturl = arg;
            currentswitch = "";
            break;
        case "-l":
            label = arg;
            currentswitch = "";
            break;
        case "-u":
            user = arg;
            currentswitch = "";
            break;
        case "-p":
            password = arg;
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
                console.log("B");
                usage_and_exit();
            }
    }
}

console.log("sourceurl = " + sourceurl);
console.log("targeturl = " + targeturl);
console.log("label = " + label);
console.log(`credentials=${user},${password}`);

if (sourceurl == "" || targeturl == "" || label == "") {
    usage_and_exit();
}

var sourceapi = p.NodeRedApi(sourceurl);
var targetapi = p.NodeRedApi(targeturl);

sourceapi
.authenticate(user, password)
.then(api => {
    sourceapi = api;
    var pusher = p.FlowPusher(sourceapi, label, targetapi);
    return pusher.pushflow();
}).then( state => {
    console.log("Deploy successful!");
}).catch(err => {
    if (err instanceof p.ErrorWrapper) {
        console.log(`Error: status=${err.status}`);
    }
    console.log("Error: " + (err.message || "") + (err.stack || "") );
});
