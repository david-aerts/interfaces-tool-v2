
import {
  bundleOpenApi,
  generateOpenApiHtmlToFile,
} from "./utils/build-api-docs.mjs";

import { PATHS } from "./utils/project-paths.mjs";
import { parsePublishArguments } from "./utils/publish-version-utils.mjs";
import { publishApis } from "./utils/publish-api-docs.mjs";
import {
  generateOpenApiReleaseNotes,
  writeOpenApiReleaseNotes,
} from "./utils/release-notes/openapi-release-notes.mjs";

const { artifactName, bumpType } = parsePublishArguments();

await publishApis({
  type: "openapi",
  typeLabel: "OpenAPI",
  definitionDirectory: PATHS.definitionOpenApis,
  publicationDirectory: PATHS.publishedVersionOpenApis,
  rootExtension: "openapi.yaml",
  bundledExtension: "openapi.yaml",
  htmlExtension: "openapi.html",
  bundle: bundleOpenApi,
  generateHtml: generateOpenApiHtmlToFile,
  generateReleaseNotes: async ({
    apiName,
    previousVersion,
    nextVersion,
    previousYamlPath,
    nextYamlPath,
    releaseNotesDirectory,
  }) => {
    const releaseNotes = await generateOpenApiReleaseNotes(
      apiName,
      previousVersion,
      nextVersion,
      previousYamlPath,
      nextYamlPath
    );

    await writeOpenApiReleaseNotes(
      releaseNotesDirectory,
      `${apiName}_v${previousVersion}_to_v${nextVersion}.release-notes`,
      releaseNotes
    );
  },
  requestedApiName: artifactName,
  bumpType,
});
