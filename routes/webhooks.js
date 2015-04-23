var express = require('express');
var router = express.Router();
var config = require('../config');
var NodeGit = require("nodegit");
var path = require("path");
var fs = require('fs');
var _ = require('lodash');
var rmdir = require('rimraf');
var mv = require('mv');
var exec = require('child_process').exec;
var git = require('gulp-git');

var request = require('request');

/* POST  */
router.post('/pages.json', function (req, res, next) {
    var payload = req.body;
    var ref = payload.ref;

    var deployRef = "refs/heads/" + config.deploy.deployBranch;

    if (ref !== deployRef) {
        return res.end();
    }

    console.log(payload);

    var repository = payload.repository;
    var url = repository.url;
    var t = url.split(':')[1].split('/');
    var projectNamespace = t[0];
    var projectName = t[1].split('.')[0];
    var workingDir = config.deploy.tmpPagesDir || config.deploy.publicPagesDir;
    var repoPath = path.resolve(workingDir, projectNamespace, projectName);

    var cloneOptions = {
        checkoutBranch: 'gl-pages',
        remoteCbPayload: function () {
            console.log.bind(console, 'remoteCb:')(arguments);
        }
    };
    cloneOptions.remoteCallbacks = {
        certificateCheck: function () {
            return 1;
        },
        credentials: function (url, userName) {
            return NodeGit.Cred.sshKeyNew(
                userName,
                config.deploy.sshPublicKey,
                config.deploy.sshPrivateKey,
                "");
        }
    };
    //console.log.bind(console, 'repoPath:')(repoPath);
    //console.log.bind(console, 'url:')(url);

    NodeGit.Clone(url, repoPath, cloneOptions)
        .catch(function (err) {
            console.log(err);
            return 1;
        })
        .done(function () {
            console.log('git checkout before');

            git.checkout('gl-pages', {
                cwd: repoPath
            }, function (err) {
                if (err) {
                    console.log(err);
                    return next(err);
                }
                git.pull('origin', 'gl-pages', {
                    cwd: repoPath
                }, function (err) {
                    if (err) {
                        console.log(err);
                        return next(err);
                    }
                    var finalRepoPath = path.resolve(config.deploy.publicPagesDir, projectNamespace, projectName);
                    rmdir(finalRepoPath, function () {
                        var cmd = "jekyll build --safe --source \"" + repoPath + "\" --destination \"" + finalRepoPath + "\"";
                        exec(cmd, function (error, stdout, stderr) {
                            if (error) {
                                console.log(error);
                                return next(err);
                            }
                            else {
                                console.log('Done deploying ' + projectNamespace + '/' + projectName);
                                res.sendStatus(200);
                                res.end();
                            }
                        });
                    });
                })
            });
        }, function (err) {
            console.log('done Error:' + err);
        });
});

//setTimeout(function () {
//    request.post('http://localhost:3000/webhooks/pages.json', {});
//}, 1000);

module.exports = router;
