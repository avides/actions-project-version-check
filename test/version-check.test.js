import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { containsVersion, getMavenArtifactVersions, isVersionUpdated } from '../src/version-check.js';

function mavenReadme(version, artifactId = 'vectis-core') {
    return `# ${artifactId}

\`\`\`xml
<dependency>
  <groupId>com.avides.vectis</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>${version}</version>
</dependency>
\`\`\`
`;
}

describe('containsVersion', () => {
    it('finds the version on its own', () => {
        assert.equal(containsVersion('<version>3.14.0</version>', '3.14.0'), true);
        assert.equal(containsVersion('uses: avides/actions-project-version-check@v3.1.0', '3.1.0'), true);
        assert.equal(containsVersion('released with 3.14.0.', '3.14.0'), true);
        assert.equal(containsVersion('releases/tag/2.0.0)', '2.0.0'), true);
    });

    it('does not find the version as part of another version', () => {
        assert.equal(containsVersion('11.0.0', '1.0.0'), false);
        assert.equal(containsVersion('1.0.0.1', '1.0.0'), false);
        assert.equal(containsVersion('1.0.0-SNAPSHOT', '1.0.0'), false);
        assert.equal(containsVersion('21.0.0', '1.0.0'), false);
    });

    it('finds a pre-release version', () => {
        assert.equal(containsVersion('<version>45.5.0-SNAPSHOT-1</version>', '45.5.0-SNAPSHOT-1'), true);
        assert.equal(containsVersion('<version>45.5.0-SNAPSHOT-12</version>', '45.5.0-SNAPSHOT-1'), false);
    });

    it('treats the version literally, not as regular expression', () => {
        assert.equal(containsVersion('3a14b0', '3.14.0'), false);
    });
});

describe('getMavenArtifactVersions', () => {
    it('returns the version of the block of the artifact', () => {
        assert.deepEqual(getMavenArtifactVersions(mavenReadme('3.14.0'), 'vectis-core'), ['3.14.0']);
    });

    it('returns the versions of all blocks of the artifact', () => {
        const readme = mavenReadme('3.14.0') + mavenReadme('3.13.0');

        assert.deepEqual(getMavenArtifactVersions(readme, 'vectis-core'), ['3.14.0', '3.13.0']);
    });

    it('ignores the blocks of other artifacts', () => {
        const readme = mavenReadme('4.1.0', 'spring-rabbit') + mavenReadme('3.14.0');

        assert.deepEqual(getMavenArtifactVersions(readme, 'vectis-core'), ['3.14.0']);
    });

    it('does not take the version of the following artifact for a block without version', () => {
        const readme = '<dependency>\n  <artifactId>vectis-core</artifactId>\n</dependency>\n' + mavenReadme('4.1.0', 'spring-rabbit');

        assert.deepEqual(getMavenArtifactVersions(readme, 'vectis-core'), [undefined]);
    });

    it('returns undefined for a broken version-element', () => {
        assert.deepEqual(getMavenArtifactVersions(mavenReadme('2.7.0').replace('</version>', '/version>'), 'vectis-core'), [undefined]);
    });

    it('does not match an artifact whose id only starts with the artifactId', () => {
        assert.deepEqual(getMavenArtifactVersions(mavenReadme('5.2.0', 'vectis-core-test'), 'vectis-core'), []);
    });
});

describe('isVersionUpdated', () => {
    describe('with the Maven block of the artifact', () => {
        it('accepts the target version in the release notes', () => {
            const readme = mavenReadme('3.14.0') + '\nSince 3.13.0 the classes that are not tied to CSV any more are named without it.\n';

            assert.equal(isVersionUpdated(readme, '3.13.0', '3.14.0', 'vectis-core'), true);
        });

        it('accepts the target version in the block of another artifact', () => {
            const readme = mavenReadme('3.14.0') + mavenReadme('3.13.0', 'vectis-avides');

            assert.equal(isVersionUpdated(readme, '3.13.0', '3.14.0', 'vectis-core'), true);
        });

        it('rejects an outdated block, even if the branch version is mentioned somewhere else', () => {
            const readme = mavenReadme('3.13.0') + '\nThe aggregation-limit is configurable since 3.14.0.\n';

            assert.equal(isVersionUpdated(readme, '3.13.0', '3.14.0', 'vectis-core'), false);
        });

        it('rejects if only one of several blocks is updated', () => {
            assert.equal(isVersionUpdated(mavenReadme('3.14.0') + mavenReadme('3.13.0'), '3.13.0', '3.14.0', 'vectis-core'), false);
        });

        it('rejects a broken version-element', () => {
            const readme = mavenReadme('2.7.0').replace('</version>', '/version>');

            assert.equal(isVersionUpdated(readme, '2.6.0', '2.7.0', 'vectis-core'), false);
        });

        it('accepts a README as Buffer, as it is read by readFileSync', () => {
            assert.equal(isVersionUpdated(Buffer.from(mavenReadme('3.14.0')), '3.13.0', '3.14.0', 'vectis-core'), true);
        });
    });

    describe('without a Maven block of the artifact', () => {
        it('accepts the branch version without the target version', () => {
            const readme = '- uses: avides/actions-project-version-check@v3.1.0\n';

            assert.equal(isVersionUpdated(readme, '3.0.1', '3.1.0', undefined), true);
        });

        it('rejects the target version', () => {
            const readme = '- uses: avides/actions-project-version-check@v3.0.1\n- uses: avides/actions-project-version-check@v3.1.0\n';

            assert.equal(isVersionUpdated(readme, '3.0.1', '3.1.0', undefined), false);
        });

        it('rejects a missing branch version', () => {
            assert.equal(isVersionUpdated('No version here', '3.0.1', '3.1.0', undefined), false);
        });

        it('accepts a branch version that contains the target version', () => {
            const readme = 'Download the JAR-file from releases/tag/11.0.0\n';

            assert.equal(isVersionUpdated(readme, '1.0.0', '11.0.0', undefined), true);
        });

        it('falls back to the plain check for a Maven project without a block of its artifact', () => {
            const readme = 'You have to download the JAR-file from [here](https://github.com/avides/sonar-avides-plugin/releases/tag/2.1.0)\n';

            assert.equal(isVersionUpdated(readme, '2.0.0', '2.1.0', 'sonar-avides-plugin'), true);
            assert.equal(isVersionUpdated(readme.replace('2.1.0', '2.0.0'), '2.0.0', '2.1.0', 'sonar-avides-plugin'), false);
        });
    });
});
