
import path from "node:path";

import { PATHS } from "./utils/project-paths.mjs";
import { pathExists } from "./utils/build-utils.mjs";
import {
  generateOpenApiReleaseNotes,
} from "./utils/release-notes/openapi-release-notes.mjs";
import { writeApiReleaseNotes } from "./utils/release-notes/api-release-notes-common.mjs";

function parseArguments() {
  const [apiName, fromVersion, toVersion] = process.argv.slice(2);

  if (!apiName || !fromVersion || !toVersion) {
    throw new Error(
      "Usage: npm run release:openapis -- <apiName> <fromVersion> <toVersion>"
    );
  }

  return { apiName, fromVersion, toVersion };
}

function getVersionedYamlPath(apiName, version) {
  return path.join(
    PATHS.publishedVersionOpenApis,
    apiName,
    `${apiName}_v${version}.openapi.yaml`
  );
}

async function main() {
  const { apiName, fromVersion, toVersion } = parseArguments();

  const previousYamlPath = getVersionedYamlPath(apiName, fromVersion);
  const nextYamlPath = getVersionedYamlPath(apiName, toVersion);

  if (!(await pathExists(previousYamlPath))) {
    throw new Error(`OpenAPI version not found: ${previousYamlPath}`);
  }

  if (!(await pathExists(nextYamlPath))) {
    throw new Error(`OpenAPI version not found: ${nextYamlPath}`);
  }

  const releaseNotes = await generateOpenApiReleaseNotes(
    apiName,
    fromVersion,
    toVersion,
    previousYamlPath,
    nextYamlPath
  );

  const releaseNotesDirectory = path.join(
    PATHS.publishedVersionOpenApis,
    apiName,
    "release-notes"
  );

  const fileBaseName = `${apiName}_v${fromVersion}_to_v${toVersion}.release-notes`;

  await writeApiReleaseNotes(releaseNotesDirectory, fileBaseName, releaseNotes);

  console.log(`Created release notes for ${apiName} ${fromVersion} -> ${toVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
