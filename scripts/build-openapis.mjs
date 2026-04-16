import { getRequestedArtifactName } from "./utils/build-utils.mjs";
import { PATHS } from "./utils/project-paths.mjs";
import {
  buildApis,
  bundleOpenApi,
  generateOpenApiHtml,
} from "./utils/build-api-docs.mjs";

const requestedApiName = getRequestedArtifactName();

await buildApis({
  kind: "OpenAPI",
  sourceDirectory: PATHS.definitionOpenApis,
  outputDirectory: PATHS.publishedCurrentOpenApis,
  rootExtension: "openapi.yaml",
  bundledExtension: "openapi.yaml",
  bundle: bundleOpenApi,
  generateHtml: generateOpenApiHtml,
  requestedApiName,
});
