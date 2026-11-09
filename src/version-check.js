// Pure functions of the version check, kept free of side effects (unlike index.js, which runs the action on import), so they can be unit tested

// The characters around a version that make it part of another version: "1.0.0" is no version on its own in "11.0.0", "1.0.0.1" or "1.0.0-SNAPSHOT",
// but it is in "v1.0.0", "@v1.0.0" or "1.0.0." at the end of a sentence
const VERSION_PREFIX_BOUNDARY = '(?<![0-9.])';
const VERSION_SUFFIX_BOUNDARY = String.raw`(?![0-9]|\.[0-9]|-[0-9A-Za-z])`;

// A block of the project's own artifact ends with its element or at the start of the next artifact or code block
const MAVEN_BLOCK_END = /<artifactId>|<\/dependency>|<\/parent>|<\/plugin>|```/;
const MAVEN_VERSION = /<version>([^<]*)<\/version>/;

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Checks if the given text contains the given version on its own, not only as part of another version.
 */
export function containsVersion(text, version) {
    return new RegExp(VERSION_PREFIX_BOUNDARY + escapeRegExp(version) + VERSION_SUFFIX_BOUNDARY).test(text);
}

/**
 * Returns the versions of all Maven blocks of the given artifact in the given text (e.g. the dependency-snippet of a README), in order of appearance.
 * A block without a valid version-element (e.g. "<version>1.0.0/version>") is returned as undefined.
 */
export function getMavenArtifactVersions(text, artifactId) {
    const artifactIdElement = new RegExp(String.raw`<artifactId>\s*` + escapeRegExp(artifactId) + String.raw`\s*</artifactId>`, 'g');
    const versions = [];

    for (const match of text.matchAll(artifactIdElement)) {
        let block = text.substring(match.index + match[0].length);
        const blockEnd = block.search(MAVEN_BLOCK_END);
        if (blockEnd >= 0) {
            block = block.substring(0, blockEnd);
        }

        versions.push(MAVEN_VERSION.exec(block)?.[1].trim());
    }

    return versions;
}

/**
 * Checks if the given content of an additional file (e.g. README.md) states the updated project version.
 * <p>
 * If the content contains Maven blocks of the given artifact, only their versions are checked, every one has to be the branch version - any other mention
 * of a version (release notes, dependencies on other artifacts) is ignored. Otherwise the branch version has to occur and the target version must not,
 * each on its own.
 *
 * @param content the content of the additional file
 * @param targetVersion the project version of the target branch
 * @param branchVersion the project version of the pull request
 * @param artifactId the Maven artifactId of the project, undefined for other projects
 * @returns true if the additional file states the branch version
 */
export function isVersionUpdated(content, targetVersion, branchVersion, artifactId) {
    const text = String(content);

    if (artifactId != undefined) {
        const versions = getMavenArtifactVersions(text, artifactId);
        if (versions.length > 0) {
            return versions.every(version => version === branchVersion);
        }
    }

    return containsVersion(text, branchVersion) && !containsVersion(text, targetVersion);
}
