import {
  bundleOpenApi,
  generateOpenApiHtmlToFile,
} from "./utils/build-api-docs.mjs";

import { PATHS } from "./utils/project-paths.mjs";
import { parsePublishArguments } from "./utils/publish-version-utils.mjs";
import { publishApis } from "./utils/publish-api-docs.mjs";

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
  requestedApiName: artifactName,
  bumpType,
});
