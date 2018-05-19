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
    var d = require('debug')('cloud-link')
    var request=require('request');

    function CloudLink(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status();

        node.server = RED.nodes.getNode(config.server);
        node.on('input', function(msg) {
            d("cloud-link.on input");

            if (toBeSentRemote(config, msg)) {
                url = config.remote;
                msg.payload.remote = true;
                var options = {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-type": "application/json"
                    },
                    json: msg.payload
                };
                d(`options=${JSON.stringify(options)}`);
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
                    else {
                        node.status({fill:"green", shape:"dot", text:"Sent to remote"});
                        setTimeout( () => {
                            node.status({});
                        }, 1000);
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
        });
    }

    function toBeSentRemote(config, msg) {
        if (msg.link && msg.link == "remote") {
            return true;
        }
        curTemp = msg.temp || 0;
        curCpu = msg.cpu || 0;
        curMem = msg.mem || 0;

        maxTemp = config.temperature;
        maxCpu = config.cpu;
        maxMem = config.mem;

        d(`cur(T,C,M)=${curTemp},${curCpu},${curMem} max(T,C,M)=${maxTemp},${maxCpu},${maxMem}`);
        return curTemp > maxTemp || curCpu > maxCpu || curMem > maxMem;
    }

    RED.nodes.registerType("cloud-link", CloudLink);
}
