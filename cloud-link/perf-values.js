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
    return Promise.all( [ memp(), tempi(), clocki(), cpup() ]).then( results => {
        return {
            "mem": results[0],
            "cpu": results[3],
            "load": os.loadavg()[0],
            "temp": results[1],
            "cpu_freq": results[2],
            "throttle": 0
        }
    });
}

function getValuesRpi() {
    return Promise.all( [ memp(), tempp(), cpup() ]).then( results => {
        return {
            "mem": results[0],
            "cpu": results[2],
            "load": os.loadavg()[0],
            "temp": results[1]
        }
    });
}

function getFullValuesRpi() {
    return Promise.all( [ memp(), tempp(), clockp(), throttledp(), cpup() ]).then( results => {
        return {
            "mem": results[0],
            "cpu": results[4],
            "load": os.loadavg()[0],
            "temp": results[1],
            "cpu_freq": results[2],
            "low_voltage": (results[3] & 1) != 0? 1 : 0,
            "arm_freq_capped": (results[3] & 2) != 0? 1 : 0,
            "turbo_disabled": (results[3] & 4) != 0? 1 : 0
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
            console.error(`Error executing ${cl}. Is it installed?.
If running inside a container, make sure you have the following lines for nodered in your docker-compose file:

environment:
  - LD_LIBRARY_PATH=/opt/vc/lib
devices:
  - /dev/vchiq:/dev/vchiq
`);

            return resolve(0)
        });
    })
}

function tempi() {
    const cl = 'sensors | grep -oP \'Core 0.*?\\+\\K[0-9.]+\'';
    return new Promise( (resolve, reject) => {
        execp(cl).then(result => {
            d(`parsed temp=${result.stdout}`)
            return resolve(parseFloat(result.stdout));
        }).catch( err => {
            console.error(`Error executing ${cl}. Is it installed?`);
            return resolve(0)
        });
    })
}

function clockp() {
    const cl = "vcgencmd measure_clock arm";

    return new Promise( (resolve, reject) => {
        execp(cl).then(result => {
            var str = result.stdout.replace("frequency(45)=", "");
            d(`parsed freq=${str}`)
            return resolve(parseFloat(str));
        }).catch( err => {
            return resolve(0)
        });
    })
}

function clocki() {
    const cl = "cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_cur_freq";
    return new Promise( (resolve, reject) => {
        execp(cl).then(result => {
            return resolve(parseFloat(result.stdout));
        }).catch( err => {
            return resolve(0)
        });
    })
}

function throttledp() {
    const cl = "vcgencmd get_throttled";

    return new Promise( (resolve, reject) => {
        execp(cl).then(result => {
            var str = result.stdout.replace("throttled=0x", "");
            d(`parsed freq=${str}`)
            return resolve(parseInt(str));
        }).catch( err => {
            return resolve(0)
        });
    })
}

const reIdle = /.* /

/*
 * This function relies on a `sar 1 > /var/tmp/sar` running in background
 */
function cpup() {
    /*
     * Both methods offer similar performance
     */
    const method = 1;
    const cl = (method == 1)?
            "tail -1 /var/tmp/sar | sed -e's/.* //'" :
            "tail -1 /var/tmp/sar"
    return new Promise( (resolve, reject) => {
        execp(cl).then(result => {
            if (result.stdout == "") {
                throw 0;
            }
            var str = (method == 1)?
                    result.stdout : result.stdout.replace(reIdle, "");
            var idle = parseFloat(str);
            return resolve(100.0 - idle);
        }).catch( err => {
            console.error(`Error executing ${cl}. This needs a \`sar 1 > /var/tmp/sar\` running in background`);
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
    getValuesRpi: getValuesRpi,
    getFullValuesRpi: getFullValuesRpi
}
