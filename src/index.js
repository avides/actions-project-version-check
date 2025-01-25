// imports
const core = require('@actions/core');
const github = require('@actions/github');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const semverDiff = require('semver-diff');

// constants
const repositoryLocalWorkspace = process.env.GITHUB_WORKSPACE + '/';

// helper functions
function getProjectVersionFromMavenFile(fileContent) {
    const parser = new xml2js.Parser();
    let projectVersion;

    parser.parseString(fileContent, function (err, result) {
        projectVersion = String(result.project.version);
    });

    return projectVersion;
}

function getProjectVersionFromPackageJsonFile(fileContent) {
    return JSON.parse(fileContent).version;
}

function getProjectVersion(fileContent, fileName) {
    if (fileName === 'pom.xml') {
        return getProjectVersionFromMavenFile(fileContent);
    }

    if (fileName === 'package.json') {
        return getProjectVersionFromPackageJsonFile(fileContent);
    }

    if (fileName === 'version.txt') {
        return new String(fileContent).trim();
    }

    core.setFailed('"' + fileName + '" is not supported!');
    return undefined;
}

function checkVersionUpdate(targetVersion, branchVersion, additionalFilesToCheck) {
    const result = semverDiff(targetVersion, branchVersion);

    if (!result) {
        console.log("targetVersion: " + targetVersion);
        console.log("branchVersion: " + branchVersion);
        console.log('semverDiff: ' + result);
        core.setFailed('You have to update the project version!');
    }
    else if (additionalFilesToCheck != undefined) {
        additionalFilesToCheck.forEach(file => {
            const fileContent = fs.readFileSync(repositoryLocalWorkspace + file.trim());

            if (!fileContent.includes(branchVersion) || fileContent.includes(targetVersion)) {
                core.setFailed('You have to update the project version in "' + file + '"!');
            }
        });
    }
}

// main
async function run() {
    try {
        // setup objects
        const octokit = new github.getOctokit(core.getInput('token'));

        // get repository owner and name
        const repository = process.env.GITHUB_REPOSITORY.split('/');
        const repositoryOwner = repository[0];
        const repositoryName = repository[1];

        // get file with updated project version
        const fileToCheck = core.getInput('file-to-check');

        // get additional files with updated project version
        let additionalFilesToCheck = core.getInput('additional-files-to-check');
        additionalFilesToCheck = additionalFilesToCheck != '' ? additionalFilesToCheck : undefined;
        if (additionalFilesToCheck != undefined) {
            additionalFilesToCheck = additionalFilesToCheck.split(',');
        }

        // get target branch
        const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
        const targetBranch = event?.pull_request?.base ? event.pull_request.base.ref : 'master';

        // get updated project version
        const updatedBranchFileContent = fs.readFileSync(repositoryLocalWorkspace + fileToCheck);
        const fileName = path.basename(repositoryLocalWorkspace + fileToCheck);
        const updatedProjectVersion = getProjectVersion(updatedBranchFileContent, fileName);

        // check version update
        if (core.getInput('only-return-version') == 'false') {
            octokit.rest.repos.getContent({ owner: repositoryOwner, repo: repositoryName, path: fileToCheck, ref: targetBranch, headers: { 'Accept': 'application/vnd.github.v3.raw' } }).then(response => {
                // get target project version
                const targetBranchFileContent = response.data;
                const targetProjectVersion = getProjectVersion(targetBranchFileContent, fileName);

                checkVersionUpdate(targetProjectVersion, updatedProjectVersion, additionalFilesToCheck);
            }).catch(error => console.log('Cannot resolve `' + fileToCheck + '` in target branch! No version check required. ErrMsg => ' + error));
        }

        // set output
        core.setOutput('version', updatedProjectVersion);
    } catch (error) {
        core.setFailed(error.message);
    }
}

// start the action
run();

// exports for unit testing
module.exports = {
    getProjectVersion,
    getProjectVersionFromMavenFile,
    getProjectVersionFromPackageJsonFile,
    checkVersionUpdate
}
