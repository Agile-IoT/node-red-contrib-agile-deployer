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
var d = require('debug')('deployer-client')
var tmp = require('tmp');

var Deployer = (deployerUrl, provider, apikey) => {

    return {
        deploy: (appname, artifactPath) => {

            return new Promise((resolve, reject) => {

                var formData = {
                    model: `{"name":"${appname}"}`,
                    file: fs.createReadStream(artifactPath),
                };

                var options = {
                    url: `${deployerUrl}/api/${provider}/applications`,
                    formData: formData,
                    headers: {
                        'X-PaaS-Credentials': JSON.stringify({ "api-key" : apikey })
                    }
                }
                request.post(
                    options, (err, res, body) => {
                        if (!err && (res.statusCode < 200 || res.statusCode >= 300)) {
                            err = new Error(
                                `Unexpected status code: ${res.statusCode} on ` +
                                `POST ${options.url}. Body=${JSON.stringify(body)}`
                            );
                            err.res = res;
                        }
                        if (err) {
                            return reject(err);
                        }
                        return resolve(body);
                    }
                );
            });
        },

        download: (archiveUrl) => {

            return new Promise((resolve, reject) => {
                var path = tmp.fileSync({keep:true});
                var downloadErr = undefined;
                request(archiveUrl)
                    .on('error', (err) => {
                        return reject(err);
                    })
                    .on('response', (res) => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            downloadErr = new Error(
                                `Unexpected status code: ${res.statusCode} on ` +
                                `GET ${archiveUrl}`
                            );
                            downloadErr.res = res;
                        }
                    })
                    .pipe(fs.createWriteStream(path.name))
                    .on('finish', (err) => {
                        if (err || downloadErr) {
                            return reject(err || downloadErr)
                        }
                        return resolve(path.name);
                    });
            });
        }
    }
}

module.exports = {
    Deployer: Deployer
}
