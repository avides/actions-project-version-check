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

Only the places that state the project's own version are checked, so other versions in the file (release notes, dependencies on other artifacts) do not fail the check:

- For a `pom.xml`, every Maven block of the project's own artifact (`<artifactId>` followed by `<version>`, e.g. the dependency-snippet of a README) has to contain the new version. Any other mention of a version is ignored.
- Otherwise, or if the file contains no such Maven block, the new version has to occur in the file and the previous one must not - each as a version on its own, so `1.0.0` is not found in `11.0.0` or `1.0.0-SNAPSHOT`.

### `only-return-version`

Is used to disable the whole version check and only return the project version as output for usage in other actions

## Outputs

### `version`

If the version update is valid then the new version is available as output. Usage:

``` yaml
- uses: avides/actions-project-version-check@latest
  id: actions_project_version_check
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    file-to-check: pom.xml

- name: use-version-from-check
  run: echo "New version is: " ${{ steps.actions_project_version_check.outputs.version }}
```

## Example usage

``` yaml
- uses: avides/actions-project-version-check@v3.1.0
- with:
    token: ${{ secrets.GITHUB_TOKEN }}
    file-to-check: package.json
    additional-files-to-check: README.md
```
