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
module.exports = function(RED) {
    //use this module to make requests
    const d = require('debug')('cloud-link')
    const request=require('request');
    const os = require('os');
    const perf = require('./perf-values')

    function CloudLink(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status();

        node.server = RED.nodes.getNode(config.server);
        node.on('input', function(msg) {
            d("cloud-link.on input");

            getValues(config.dummy, msg).then( result => {
                var thresholds = msg.payload.thresholds ||
                    {
                        "mem": config.mem, "cpu": config.cpu, "temp": config.temperature
                    };
                msg.payload.thresholds = thresholds;
                msg.payload.values = result;
                if (msg.link == "remote" || toBeSentRemote(thresholds, result)) {
                    url = config.remote;
                    msg.payload.remote = true;
                    var options = {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-type": "application/json",
                            "Keep-Alive": "timeout=240, max=100"
                        },
                        json: msg.payload
                    };
                    //d(`options=${JSON.stringify(options)}`);
                    node.status({fill:"green", shape:"dot", text:"Sent to remote"});
                    setTimeout( () => {
                        node.status({});
                    }, 1000);
                    request(url, options, (err, res, body) => {
                        if (!err && (res.statusCode < 200 || res.statusCode >= 300)) {
                            method = options["method"] || "GET";
                            err = new Error(
                                `${res.statusCode} ${method} ${url}: ${JSON.stringify(body)}`
                            );
                            err.res = res;
                        }
                        if (err) {
                            node.status({fill:"red", shape:"ring", text:err.message});
                            msg.payload = undefined;
                        }

                        msg.payload = body;
                        msg.status = (res && res.statusCode) || undefined;
                        node.send([null, msg]);
                    });

                } else {
                    node.status({fill:"green", shape:"dot", text:"Sent to local"});
                    setTimeout( () => {
                        node.status({});
                    }, 1000);
                    node.send([msg, null]);
                }
            }).catch(err=> {
                d(`cloud-link.on: error=${err}`)
                node.status({fill:"red", shape:"ring", text:`${err}`});
            });
        });
    }

    /*
     * Tries to get (cpu, temp, mem) values from device
     * - dummy : if dummy, returns directly the msg parameter
     * - msg: values to return when dummy is true
     *
     * Returns { "mem": memValue, "temp": tempValue, "cpu": cpuValue}
     */
    function getValues(dummy, msg) {

        if (dummy) {
            d(`dummy mode`)
            return Promise.resolve(
                { "temp": msg.temp, "cpu": msg.cpu, "mem": msg.mem }
            );
        } else if (os.arch() == "arm64") {
            d(`arm64 mode`)
            return perf.getValuesRpi();
        } else {
            d(`x64 mode`)
            return perf.getValuesX64();
        }
    }

    function toBeSentRemote(thresholds, values) {
        curTemp = values.temp || 0;
        curCpu = values.cpu || 0;
        curMem = values.mem || 0;

        maxTemp = thresholds.temp;
        maxCpu = thresholds.cpu;
        maxMem = thresholds.mem;

        d(`cur(T,C,M)=${curTemp},${curCpu},${curMem} max(T,C,M)=${maxTemp},${maxCpu},${maxMem}`);
        return curTemp > maxTemp || curCpu > maxCpu || curMem > maxMem;
    }

    RED.nodes.registerType("cloud-link", CloudLink);
}
