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
    var d = require('debug')('tab-deploy')
    var p = require('./flow-pusher')

    function TabDeploy(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status();

        d(`tab-deploy: config={ ${config.tab} ${config.remote} ${config.name} }`);
        node.on('input', function(msg) {

            var sourceurl = msg.sourceurl || "http://localhost:1880/red";
            var user = msg.payload.user || undefined;
            var pwd = msg.payload.password || undefined;

            var sourceapi = p.NodeRedApi(sourceurl);
            var targetapi = p.NodeRedApi(config.remote);

            d(`Deploying ${config.tab} on ${config.remote}; local user is ${user}`);
            node.status({fill:"yellow", shape:"circle", text:"Deploying"});

            sourceapi
                .authenticate(user, pwd)
                .then(api => {
                    sourceapi = api;
                    var pusher = p.FlowPusher(sourceapi, config.tab, targetapi);
                    return pusher.pushflow();
                }).then( state => {
                    node.status({fill:"green", shape:"dot", text:"Deployed"});
                }).catch(err => {
                    var message = err.message || "not deployed";
                    node.status({fill:"red",shape:"ring",text:message});
                    console.log(err);
                });
        });

    }

    RED.nodes.registerType("tab-deploy", TabDeploy);
}
