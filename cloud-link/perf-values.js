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
"use strict"

const os = require('os')
const fs = require('fs')
const exec = require('child_process').exec;
const d = require('debug')('perf-values')

function getValuesX64() {
    return Promise.all( [ memp() ]).then( results => {
        return {
            "mem": results[0],
            "cpu": os.loadavg()[0] / os.cpus().length,
            "temp": 0
        }
    });
}

function getValuesRpi() {
    return Promise.all( [ memp(), tempp() ]).then( results => {
        return {
            "mem": results[0],
            "cpu": os.loadavg()[0] / os.cpus().length,
            "temp": results[1]
        }
    });
}

const reTotal = /MemTotal: *([0-9]+) .*/
const reAvail = /MemAvailable: *([0-9]+) .*/


function memp() {
    return new Promise( (resolve, reject) => {
        fs.readFile("/proc/meminfo", "utf8", (err, data) => {
            if (err) {
                reject(err)
            }
            var lines = data.split("\n");
            var avail = lines.find( item => {
                return item.startsWith("MemAvailable")
            });
            var total = lines.find( item => {
                return item.startsWith("MemTotal")
            })
            if (avail == undefined || total === undefined) {
                reject("Could not read /proc/meminfo")
            }
            try {
                var mAvail = parseInt(reAvail.exec(avail)[1]);
                var mTotal = parseInt(reTotal.exec(total)[1]);
                var usage = 100.0 * (1 - mAvail / mTotal);
                resolve(usage);
            } catch (err) {
                reject(err)
            }
        })
    });
}

function tempp() {
    const cl = "vcgencmd measure_temp";

    return new Promise( (resolve, reject) => {
        execp(cl).then(result => {
            var str = result.stdout.replace("temp=", "").replace("'C", "");
            d(`parsed temp=${str}`)
            return resolve(parseFloat(str));
        }).catch( err => {
            return resolve(0)
        });
    })

}

function execp(cmd, opts) {
    opts || (opts = {});
    d(`executing ${cmd}`)
    return new Promise((resolve, reject) => {
        exec(cmd, opts, (err, stdout, stderr) => {
            if (err) {
                d(`execp: error=${err}`)
                return reject(err);
            }
            else {
                d(`execp: stdout=${stdout}`)
                return resolve({
                    stdout: stdout,
                    stderr: stderr
                });
            }
        });
    });
}

module.exports = {
    getValuesX64: getValuesX64,
    getValuesRpi: getValuesRpi
}