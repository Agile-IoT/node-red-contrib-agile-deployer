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
const d = require('debug')('perf-values')
const p = require('./perf-values')
const os = require('os')

var f = undefined

if (process.argv.length > 1) {
    f = p[process.argv[process.argv.length - 1]]
}

if (!f) {
    if (os.arch().startsWith("arm")) {
        f = p.getFullValuesRpi;
    } else {
        f = p.getValuesX64;
    }
}

console.log("Using function " + f);


f()
.then(values => {
    console.log(`values = ${JSON.stringify(values)}`);
}).catch(err => {
    console.log("Error: " + (err.message || "") + (err.stack || "") );
});
