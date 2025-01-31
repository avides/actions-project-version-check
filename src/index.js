// imports
import { setFailed, getInput, setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';
import { Parser } from 'xml2js';
import { readFileSync } from 'fs';
import { basename } from 'path';
import semverDiff from 'semver-diff';

// constants
const repositoryLocalWorkspace = process.env.GITHUB_WORKSPACE + '/';

// helper functions
function getProjectVersionFromMavenFile(fileContent) {
    const parser = new Parser();
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

    setFailed('"' + fileName + '" is not supported!');
    return undefined;
}

function checkVersionUpdate(targetVersion, branchVersion, additionalFilesToCheck) {
    const result = semverDiff(targetVersion, branchVersion);

    if (!result) {
        console.log("targetVersion: " + targetVersion);
        console.log("branchVersion: " + branchVersion);
        console.log('semverDiff: ' + result);
        setFailed('You have to update the project version!');
    }
    else if (additionalFilesToCheck != undefined) {
        additionalFilesToCheck.forEach(file => {
            const fileContent = readFileSync(repositoryLocalWorkspace + file.trim());

            if (!fileContent.includes(branchVersion) || fileContent.includes(targetVersion)) {
                setFailed('You have to update the project version in "' + file + '"!');
            }
        });
    }
}

// main
async function run() {
    try {
        // setup objects
        const octokit = new getOctokit(getInput('token'));

        // get repository owner and name
        const repository = process.env.GITHUB_REPOSITORY.split('/');
        const repositoryOwner = repository[0];
        const repositoryName = repository[1];

        // get file with updated project version
        const fileToCheck = getInput('file-to-check');

        // get additional files with updated project version
        let additionalFilesToCheck = getInput('additional-files-to-check');
        additionalFilesToCheck = additionalFilesToCheck != '' ? additionalFilesToCheck : undefined;
        if (additionalFilesToCheck != undefined) {
            additionalFilesToCheck = additionalFilesToCheck.split(',');
        }

        // get target branch
        const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH));
        const targetBranch = event?.pull_request?.base ? event.pull_request.base.ref : 'master';

        // get updated project version
        const updatedBranchFileContent = readFileSync(repositoryLocalWorkspace + fileToCheck);
        const fileName = basename(repositoryLocalWorkspace + fileToCheck);
        const updatedProjectVersion = getProjectVersion(updatedBranchFileContent, fileName);

        // check version update
        if (getInput('only-return-version') == 'false') {
            octokit.rest.repos.getContent({ owner: repositoryOwner, repo: repositoryName, path: fileToCheck, ref: targetBranch, headers: { 'Accept': 'application/vnd.github.v3.raw' } }).then(response => {
                // get target project version
                const targetBranchFileContent = response.data;
                const targetProjectVersion = getProjectVersion(targetBranchFileContent, fileName);

                checkVersionUpdate(targetProjectVersion, updatedProjectVersion, additionalFilesToCheck);
            }).catch(error => console.log('Cannot resolve `' + fileToCheck + '` in target branch! No version check required. ErrMsg => ' + error));
        }

        // set output
        setOutput('version', updatedProjectVersion);
    } catch (error) {
        setFailed(error.message);
    }
}

// start the action
run();

// exports for unit testing
export default {
    getProjectVersion,
    getProjectVersionFromMavenFile,
    getProjectVersionFromPackageJsonFile,
    checkVersionUpdate
}
