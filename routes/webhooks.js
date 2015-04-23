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
    payload = {
        object_kind: 'push',
        before: '8210661526e6069729535d7da8effbf1178758cd',
        after: '6e9885e1119dad2539cade78ae9285d9aef32999',
        ref: 'refs/heads/gl-pages',
        checkout_sha: '6e9885e1119dad2539cade78ae9285d9aef32999',
        user_id: 1,
        user_name: 'Administrator',
        user_email: 'admin@example.com',
        project_id: 2,
        repository: {
            name: 'test',
            url: 'git@git.lingyong.me:root/test.git',
            description: 'adf',
            homepage: 'http://git.lingyong.me/root/test',
            git_http_url: 'http://git.lingyong.me/root/test.git',
            git_ssh_url: 'git@git.lingyong.me:root/test.git',
            visibility_level: 20
        },
        commits: [{
            id: '6e9885e1119dad2539cade78ae9285d9aef32999',
            message: 'test\n',
            timestamp: '2015-04-22T12:30:13+08:00',
            url: 'http://git.lingyong.me/root/test/commit/6e9885e1119dad2539cade78ae9285d9aef32999',
            author: [Object]
        },
            {
                id: '8929b93bc8ff22f576132b59d95e027632cf0d9f',
                message: 'test\n',
                timestamp: '2015-04-22T12:07:38+08:00',
                url: 'http://git.lingyong.me/root/test/commit/8929b93bc8ff22f576132b59d95e027632cf0d9f',
                author: [Object]
            },
            {
                id: '8210661526e6069729535d7da8effbf1178758cd',
                message: 'init\n',
                timestamp: '2015-04-22T11:43:30+08:00',
                url: 'http://git.lingyong.me/root/test/commit/8210661526e6069729535d7da8effbf1178758cd',
                author: [Object]
            }],
        total_commits_count: 3
    };
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
    console.log.bind(console, 'repoPath:')(repoPath);
    console.log.bind(console, 'url:')(url);

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

setTimeout(function () {
    request.post('http://localhost:3000/webhooks/pages.json', {});
}, 1000);

module.exports = router;
