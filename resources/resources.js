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
    const d = require('debug')('resources')
    const os = require('os');
    const perf = require('../cloud-link/perf-values')

    function Resources(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status();

        node.server = RED.nodes.getNode(config.server);
        node.on('input', function(msg) {
            d("resources.on input");

            getValues(config.dummy, msg).then( result => {
                // include output from node-red-contrib-cpu
                if (msg.topic == "overall") {
                    result.cpu = msg.payload;
                }
                result.timestamp = new Date().getTime();
                msg.payload = result;
                node.send(msg);
            }).catch(err=> {
                d(`resources.on: error=${err}`)
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

        if (os.arch().startsWith("arm")) {
            d(`arm64 mode`)
            return perf.getFullValuesRpi();
        } else {
            d(`x64 mode`)
            return perf.getValuesX64();
        }
    }

    RED.nodes.registerType("resources", Resources);
}
