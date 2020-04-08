// imports
const core = require('@actions/core');
const github = require('@actions/github');
const xml2js = require('xml2js');
const fs = require('fs');
const semverDiff = require('semver-diff');

// constants
const repositoryLocalWorkspace = process.env.GITHUB_WORKSPACE + '/';

// helper functions
function getProjectVersionFromMavenFile(fileContent)
{
    var parser = new xml2js.Parser();
    var projectVersion;

    parser.parseString(fileContent, function(err, result) {
        projectVersion = String(result.project.version);
    });

    return projectVersion;
}

function getProjectVersionFromPackageJsonFile(fileContent)
{
    return JSON.parse(fileContent).version;
}

function getProjectVersion(fileContent, fileType)
{
    if (fileType == 'xml')
    {
        return getProjectVersionFromMavenFile(fileContent);
    }

    if (fileType == 'json')
    {
        return getProjectVersionFromPackageJsonFile(fileContent);
    }

    if (fileType == 'txt')
    {
        return fileContent;
    }

    core.setFailed(fileType + ' is not supported!');
    return undefined;
}

function checkVersionUpdate(targetVersion, branchVersion, additionalFilesToCheck)
{
    var result = semverDiff(targetVersion, branchVersion);

    if (!result)
    {
        console.log("targetVersion: " + targetVersion);
        console.log("branchVersion: " + branchVersion);
        console.log('semverDiff: ' + result);
        core.setFailed('You have to update the project version!');
    }
    else if (additionalFilesToCheck != undefined)
    {
        additionalFilesToCheck.forEach(file => 
        {
            var fileContent = fs.readFileSync(repositoryLocalWorkspace + file);
            
            if (!fileContent.includes(branchVersion) || fileContent.includes(targetVersion))
            {
                core.setFailed('You have to update the project version in "' + file + '"!');
            }
        });
    }
}

// main
async function run() 
{
    try
    {
        // setup objects
        var octokit = new github.GitHub(core.getInput('token'));

        // get repository owner and name
        var repository = process.env.GITHUB_REPOSITORY.split('/');
        var repositoryOwner = repository[0];
        var repositoryName = repository[1];

        // get file with updated project version
        var fileToCheck = core.getInput('file-to-check');
        var fileToCheckFileType = fileToCheck.split('.')[1];

        // get additional files with updated project version
        var additionalFilesToCheck = core.getInput('additional-files-to-check');
        additionalFilesToCheck = core.getInput('additional-files-to-check') != '' ? core.getInput('additional-files-to-check') : undefined;
        if (additionalFilesToCheck != undefined)
        {
            additionalFilesToCheck = additionalFilesToCheck.split(',');
        }

        // get target branch
        var event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
        var targetBranch = event && event.pull_request && event.pull_request.base ? event.pull_request.base.ref : 'master';

        // check version update
        octokit.repos.getContents({owner: repositoryOwner, repo: repositoryName, path: fileToCheck, ref: targetBranch, headers: { 'Accept': 'application/vnd.github.v3.raw' }}).then(response =>
        {
            // read file contents
            var targetBranchFileContent = response.data;
            var updatedBranchFileContent = fs.readFileSync(repositoryLocalWorkspace + fileToCheck);

            // version check
            var targetProjectVersion = getProjectVersion(targetBranchFileContent, fileToCheckFileType);
            var updatedProjectVersion = getProjectVersion(updatedBranchFileContent, fileToCheckFileType);
            checkVersionUpdate(targetProjectVersion, updatedProjectVersion, additionalFilesToCheck);

            // export version
            core.setOutput('version', updatedProjectVersion);
        }).catch(error => console.log('Cannot resolve `' + fileToCheck + '` in target branch! No version check required. ErrMsg => ' + error));
    } catch (error)
    {
        core.setFailed(error.message);
    }
}

// start the action
run();

// exports for unit testing
module.exports = 
{
    getProjectVersion,
    getProjectVersionFromMavenFile,
    getProjectVersionFromPackageJsonFile,
    checkVersionUpdate
}
