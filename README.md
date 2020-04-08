# actions-project-version-check

This action checks if the project version has been updated in your pull request. The action will request the file content (from file with name from envrionment variable `file-to-check`) from the pull request target branch and parse the project version. After that the local project version will be checked against the targets one with [semver-diff](https://www.npmjs.com/package/semver-diff). If the result is `undefined`, the action fail.

Currently supported are `pom.xml`, `package.json` and `version.txt`.

## Inputs

### `token`

**Required** The repository token is used to request the target branch `file-to-check`-file from the [GitHub API](https://developer.github.com/v3/repos/contents/#get-contents)

### `file-to-check`

**Required** Filename (with path) that must contain the project version update (examples: pom.xml, package.json, version.txt)

### `additional-files-to-check`

Comma seperated list of filenames (with path) that contains the same version as "file-to-check" (examples: README.md, src/file-with-version.txt)

## Outputs

### `version`

If the version update is valid then the new version is available as output.

## Example usage
```
- uses: avides/actions-project-version-check@v1.0.0
- with:
    token: ${{ secrets.GITHUB_TOKEN }}
    file-to-check: package.json
    additional-files-to-check: README.md
```
