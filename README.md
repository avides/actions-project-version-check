# actions-project-version-check

This action checks if the project version has been updated in your pull request. The action will request the file content (file with name from environment variable `file-to-check`) from the pull request target branch and parse the project version. After that the local project version will be checked against the targets one with [semver-diff](https://www.npmjs.com/package/semver-diff). If the new version is not higher than the old one from target, the action fails.

Currently supported are `pom.xml`, `package.json` and `version.txt`.

## Inputs

### `token`

**Required** The repository token is used to request the target branch `file-to-check`-file from the [GitHub API](https://developer.github.com/v3/repos/contents/#get-contents)

### `file-to-check`

**Required** Filename (with path) that must contain the project version update (examples: pom.xml, package.json or version.txt)

### `additional-files-to-check`

Comma separated list of filenames (with path) that must contain the same version as "file-to-check" (examples: README.md, src/file-with-version.txt)

### `only-return-version`

Is used to disable the whole version check and only return the project version as output for usage in other actions

## Outputs

### `version`

If the version update is valid then the new version is available as output. Usage:
```
- uses: avides/actions-project-version-check@latest
  id: actions_project_version_check
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    file-to-check: pom.xml

- name: use-version-from-check
  run: echo "New version is: " ${{ steps.actions_project_version_check.outputs.version }}
```

## Example usage
```
- uses: avides/actions-project-version-check@v1.2.1
- with:
    token: ${{ secrets.GITHUB_TOKEN }}
    file-to-check: package.json
    additional-files-to-check: README.md
```
