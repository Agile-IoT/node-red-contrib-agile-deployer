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
    var d = require('debug')('heroku-deploy')
    var dc = require('./deployer-client')

    function HerokuDeploy(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status();

        //node.server = RED.nodes.getNode(config.server);
        node.on('input', function(msg) {
            d("heroku-deploy.on input");
            node.status();

            var deployer = dc.Deployer(config.deployerurl, "heroku", config.apikey);

            deployer.download(config.archive)
            .then( (path) => {
                node.status("Deploying");
                return deployer.deploy(config.appname, path);
            }).then( (out) => {
                node.status({fill:"green", shape:"dot", text:"Deployed"});
            }).catch( (err) => {
                var message = err.message || "Not deployed";
                node.status({fill:"red",shape:"ring",text:message});
                console.log(err);
            });
        });

    }

    RED.nodes.registerType("heroku-deploy", HerokuDeploy);
}
