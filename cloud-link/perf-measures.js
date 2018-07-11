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
    const d = require('debug')('perf-measures')
    const request=require('request');
    const os = require('os');
    const perf = require('./perf-values')

    function PerfMeasures(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status();

        node.server = RED.nodes.getNode(config.server);
        node.on('input', function(msg) {
            d("perf-measures.on input");

            getValues(config.dummy, msg).then( result => {
                var thresholds = msg.payload.thresholds ||
                    {
                        "mem": config.mem, "cpu": config.cpu, "temp": config.temperature
                    };
                msg.payload.thresholds = thresholds;
                msg.payload.values = result;
                node.send(msg);
            }).catch(err=> {
                d(`perf-measures.on: error=${err}`)
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
        } else if (os.arch().startsWith("arm")) {
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

    RED.nodes.registerType("perf-measures", PerfMeasures);
}
