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
var request=require('request');
var fs = require('fs');
var d = require('debug')('flow-pusher')

function prequest(url, options, transform) {

    return new Promise((resolve, reject) => {
        d(`request(${url}, ${JSON.stringify(options)})`);
        request(url, options, (err, res, body) => {
            if (!err && (res.statusCode < 200 || res.statusCode >= 300)) {
                method = options["method"] || "GET";
                err = new Error(
                    `Unexpected status code: ${res.statusCode} on ` +
                    `${method} ${url}. Body=${JSON.stringify(body)}`
                );
                err.res = res;
            }
            if (err) {
                d(`reject(${err})`);
                var e, message;
                if (body) {
                    message = body.message? body.message : body;
                    e = new ErrorWrapper(err, res.statusCode, message);
                } else {
                    e = err;
                }
                return reject(e);
            }
            d(`request(${url}. Output: ${JSON.stringify(body)}`);
            if (transform === undefined) {
                resolve(body);
            }
            else {
                resolve(transform(body));
            }
        });
    });
}

function ErrorWrapper(err, status, message) {
    this.err = err;
    this.status = status;
    this.message = message;
}

/*
 * Node-RED API abstraction for the secured Node-RED on AGILE.
 *
 * Parameters:
 * - baseurl: Node-RED instance address
 * - token: Node-RED token (as returned by authenticate())
 */
var NodeRedApi = (baseurl, token) => {

    function get_options(other) {
        var options = {
            headers: {
                "Accept": "application/json",
            },
            json: true
        };
        var result = Object.assign(options, other);   // Object.assign modifies "options"
        if (token !== undefined) {
            options.headers.Authorization = `Bearer ${token}`;
        }
        return result;
    }

    return {

        baseurl: baseurl,

        /*
         * Gets token for a secured Node-RED, authenticating using user and password.
         *
         * If user is undefined, does not authenticate
         */
        authenticate: (user, password) => {
            var url = `${baseurl}/auth/token`;
            var data = `client_id=node-red-admin&grant_type=password&scope=*&username=${user}&password=${password}`;
            data = {
                "client_id" : "node-red-admin",
                "grant_type": "password",
                "scope": "*",
                "username": `${user}`,
                "password": `${password}`
            }
            if (user === undefined) {
                return Promise.resolve(NodeRedApi(baseurl));
            }
            return prequest(
                url,
                get_options({
                    "method": "POST",
                    "form": data,
                    "json": false,
                    "headers" : { "Content-type": "application/x-www-form-urlencoded"}
                }),
                (body) => {
                    var json = JSON.parse(body);
                    var token = json.access_token;
                    return NodeRedApi(baseurl, token);
                }
            );
        },

        /*
         * Returns all deployed nodes (excluding configuration).
         * There is one node with type="tab" per flow.
         *
         * It is an array of nodes
         */
        fetchcurrentflows: () => {
            var url = `${baseurl}/flows`;
            return prequest(url, get_options());
        },

        /*
         * Returns nodes from flow with id "tab_id".
         *
         * It is an object with the following fields:
         * - id
         * - label
         * - nodes (array of nodes)
         */
        fetchflow: (tab_id) => {
            var url = `${baseurl}/flow/${tab_id}`;
            return prequest(url, get_options());
        },

        /*
         * Return global nodes (config nodes).
         *
         * It is an object with the following fields:
         * - id ( = global)
         * - configs (array of nodes)
         */
        fetchglobalflow: () => {
            var url = `${baseurl}/flow/global`;
            return prequest(url, get_options());
        },

        postflows: (flowtopush, deployment_type) => {
            var url = `${baseurl}/flows`;
            return prequest(
                url,
                get_options({
                    "method": "POST",
                    "json": flowtopush,
                    "headers":  {
                        "Node-RED-Deployment-Type" : deployment_type || "full"
                    }
                })
            );
        },

        postflow: (flowtopush) => {
            var url = `${baseurl}/flow`;
            return prequest(
                url,
                get_options({
                    "method": "POST",
                    "json": flowtopush,
                })
            );
        },

        deleteflow: (tab_id) => {
            var url = `${baseurl}/flow/${tab_id}`;
            return prequest(
                url,
                get_options({
                    "method": "DELETE"
                })
            );
        },
    }
}

/*
 * Util functions to work with Node-RED workflows.
 *
 * A workflow is the JSON deserialization of the result of calling the Node-RED API.
 */
var FlowUtils = () => {

    const Types = {
        TAB : "tab",
        UI_BASE : "ui_base",
        LINK_IN : "link in",
        LINK_OUT : "link out",
        HTTP_IN : "http in",
        HTTP_OUT : "http response",
        HTTP_REQUEST : "http request"
    };

    /*
     * Simple function to clone a structure of nodes.
     * (valid while there are not callables)
     */
    function clone(o) {
        return JSON.parse(JSON.stringify(o));
    }

    /*
     * The same ID-generation function nodered uses
     */
    function getID() {
        return (1+Math.random()*4294967295).toString(16);
    }

    function findnodes(nodesarray, matchfunction) {
        return nodesarray.filter(matchfunction);
    }

    function findnode(nodesarray, matchfunction) {
        return nodesarray.find(matchfunction);
    }

    function findtabnode(currentflows, sourcelabel) {

        var tabnode = findnode(
            currentflows,
            n => n.type === Types.TAB && n.label === sourcelabel
        );
        return tabnode;
    }

    function findnodesintab(tabflow_) {

        return findnodes(
            tabflow_.nodes,
            n => !n.type.startsWith("subflow")
        );
    }

    function findconfignodes(configtab) {

        var confignodes = findnodes(
            configtab.configs || [],
            n => !n.type.startsWith("ui_") && n.type != "xively-config"
        );
        return confignodes;
    }

    function istype(node, type) {
        return node.type == type;
    }

    function isintab(node, tabnode) {
        return node.z != undefined && node.z == tabnode.id;
    }

    function islinkingto(node, to) {
        return node.links && node.links.length == 1 && node.links[0] == to.id;
    }

    function findlinkinnode(nodes) {
        var linkin_node = findnode(
            nodes, n => n.type == Types.LINK_IN
        );
        return linkin_node;
    }

    function convert_to_http_in(node, path) {

        node.type = Types.HTTP_IN;
        node.url = path;        // path is sth like "/somepath"
        node.method = "post";
    }

    function convert_to_http_out(node) {
        node.type = Types.HTTP_OUT;
    }

    function convert_to_http_request(node, remoteurl) {
        node.type = Types.HTTP_REQUEST;
        node.url = remoteurl;
        node.method = "POST";
    }

    function newnode(type, attrs) {
        n = {
            id : getID(),
            type : type
        }
        Object.assign(n, attrs);
        return n;
    }

    function linknodes(nodeout, nodein) {
        if (nodeout.wires.length == 0) {
            inner = [];
            nodeout.wires.push(inner);
        }
        else {
            inner = nodeout.wires[0];
        }
        inner.push(nodein.id);
    }

    return {
        Types : Types,
        clone : clone,
        findnode : findnode,
        findnodes : findnodes,
        findtabnode : findtabnode,
        findnodesintab : findnodesintab,
        findconfignodes : findconfignodes,
        findlinkinnode : findlinkinnode,
        convert_to_http_in : convert_to_http_in,
        convert_to_http_out : convert_to_http_out,
        convert_to_http_request : convert_to_http_request,
        linknodes : linknodes,
        newnode : newnode,
        istype : istype,
        isintab : isintab,
        islinkingto : islinkingto
    }
}

/*
 * Performs an upload of a tab in a workflow on a source Node-RED instance to a target Node-RED instance.
 * The source is workflow is modified in such a way that the data entering to that tab is forwarded to
 * the remote instance.
 *
 * Parameters:
 * - sourceapi: NodeRedApi "object" of source Node-RED instance
 * - sourcelabel: label of tab to push to target Node-RED
 * - targeturl: NodeRedApi "object" of target Node-RED instance
 */
var FlowPusher = (sourceapi, sourcelabel, targetapi) => {

    const utils = FlowUtils();
    const Types = utils.Types;
    const clone = utils.clone;

    function build_path(node) {
        return `/${node.id}`
    }
    /*
     * Modify flow to push to remote, converting
     * link_in nodes into http_in nodes.
     */
    function modify_flowtopush(flow) {

        var linkin_nodes = utils.findnodes(
            flow, n => utils.istype(n, Types.LINK_IN));

        var linkout_nodes = utils.findnodes(
            flow, n => utils.istype(n, Types.LINK_OUT))

        linkin_nodes.forEach(linkin_node => {
            utils.convert_to_http_in(linkin_node, build_path(linkin_node));
        });

        linkout_nodes.forEach(linkout_node => {
            utils.convert_to_http_out(linkout_node);
        });
    }

    /*
     * Convert all link_out nodes to a tab into http_request nodes. Returns
     * the modified flows as a copy of the original flows.
     *
     * The function finds the link_in nodes to the tab, then finds the link_out
     * nodes to each link_in nodes, converting them to a proper http_request
     */
    function modify_link_out_nodes(currentnodes, tabnode) {
        var modifiednodes = clone(currentnodes);

        var linkin_nodes = utils.findnodes(
            modifiednodes,
            n => utils.istype(n, Types.LINK_IN) && utils.isintab(n, tabnode)
        );

        linkin_nodes.forEach(in_ => {
            const remoteurl = `${targeturl}${build_path(in_)}`;

            var linkout_nodes = utils.findnodes(
                modifiednodes,
                out => utils.istype(out, Types.LINK_OUT) &&
                       utils.islinkingto(out, in_));

            linkout_nodes.forEach( out => {
                utils.convert_to_http_request(out, remoteurl);
            });
        });
        return modifiednodes;
    }

    /*
     * Calculates nodeset1 - nodeset2
     * (i.e., each element in nodeset1 but not in nodeset2)
     */
    function difference(nodeset1, nodeset2) {
        nodemap2 = {};
        nodeset2.forEach(n => {
            nodemap2[n.id] = n;
        });
        var result = [];
        nodeset1.forEach(n => {
            if (nodemap2[n.id] === undefined) {
                result.push(n);
            }
        });
        return result;
    }

    return {
        pushflow: () => {
            return new Promise((resolve, reject) => {

                /*
                 * Implementation note: nodes must be cloned when is intended to be
                 *  modified. Nodes are not being cloned by default.
                 */
                var sourceflownodes;
                var tabnode;
                var sourceconfignodes;
                var confignodestopush;
                var flowtopush;

                /*
                 * Get all source flows to find the source flow we want to push
                 */
                sourceapi.fetchcurrentflows()
                .then(sourceflows => {
                    tabnode = utils.findtabnode(sourceflows, sourcelabel);

                    return sourceapi.fetchflow(tabnode["id"]);
                }).then(sourceflow => {
                    /*
                     * sourceflow is the flow to push
                     */
                    sourceflownodes = utils.findnodesintab(sourceflow);

                    return sourceapi.fetchglobalflow();
                }).then(sourceglobalflow => {
                    /*
                     * sourceconfignodes are needed to push the config nodes
                     * to remote instance.
                     */
                    sourceconfignodes = utils.findconfignodes(sourceglobalflow);

                    return targetapi.fetchcurrentflows();
                }).then(remoteflows => {

                    /*
                     * the difference is calculated to avoid repeating node ids.
                     */
                    confignodestopush = difference(sourceconfignodes, remoteflows || []);
                    flowtopush = {
                        "id": tabnode["id"],
                        "label": sourcelabel,
                        "nodes": sourceflownodes,
                        "configs": confignodestopush
                    }
                    d(`configs: ${JSON.stringify(confignodestopush)}`)

                    modify_flowtopush(flowtopush.nodes);
                    /* flowtopush now contains the flow to push */

                    /*
                     * Now let's remove the flow if already exists on remote
                     */
                    var remotetabnode = utils.findtabnode(remoteflows, sourcelabel);
                    if (remotetabnode) {
                        return targetapi.deleteflow(remotetabnode["id"]);
                    } else {
                        return undefined;
                    }

                }).then( () => {
                    /*
                     * Ready to push the flow!
                     */
                    return targetapi.postflow(flowtopush);
                }).then(body => {

                    /*  Does nothing */
                    return resolve(true);

                }).catch(err => {

                    return reject(err);
                });
            });
        }
    };
};

module.exports = {
    ErrorWrapper: ErrorWrapper,
    FlowPusher : FlowPusher,
    FlowUtils: FlowUtils,
    NodeRedApi: NodeRedApi
}
