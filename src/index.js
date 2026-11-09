// imports
import { setFailed, getInput, setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';
import { Parser } from 'xml2js';
import { readFileSync } from 'fs';
import { basename } from 'path';
import semverDiff from 'semver-diff';
import { isVersionUpdated } from './version-check.js';

// constants
const repositoryLocalWorkspace = process.env.GITHUB_WORKSPACE + '/';

// helper functions
function getProjectElementFromMavenFile(fileContent, elementName) {
    const parser = new Parser();
    let element;

    parser.parseString(fileContent, function (err, result) {
        element = String(result.project[elementName]);
    });

    return element;
}

function getProjectVersionFromMavenFile(fileContent) {
    return getProjectElementFromMavenFile(fileContent, 'version');
}

function getArtifactIdFromMavenFile(fileContent) {
    return getProjectElementFromMavenFile(fileContent, 'artifactId');
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

function checkVersionUpdate(targetVersion, branchVersion, additionalFilesToCheck, artifactId) {
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

            if (!isVersionUpdated(fileContent, targetVersion, branchVersion, artifactId)) {
                setFailed('You have to update the project version in "' + file + '" to ' + branchVersion + '!');
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
        // the Maven blocks of this artifact state its version in the additional files, e.g. the dependency-snippet of the README
        const artifactId = fileName === 'pom.xml' ? getArtifactIdFromMavenFile(updatedBranchFileContent) : undefined;

        // check version update
        if (getInput('only-return-version') == 'false') {
            octokit.rest.repos.getContent({ owner: repositoryOwner, repo: repositoryName, path: fileToCheck, ref: targetBranch, headers: { 'Accept': 'application/vnd.github.v3.raw' } }).then(response => {
                // get target project version
                const targetBranchFileContent = response.data;
                const targetProjectVersion = getProjectVersion(targetBranchFileContent, fileName);

                checkVersionUpdate(targetProjectVersion, updatedProjectVersion, additionalFilesToCheck, artifactId);
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
    getArtifactIdFromMavenFile,
    getProjectVersionFromPackageJsonFile,
    checkVersionUpdate
}
