// scripts/build-openapis.mjs

import path from "node:path";
import {
  buildApis,
  bundleOpenApi,
  generateOpenApiHtml,
} from "./utils/build-api-docs.mjs";

const PROJECT_ROOT = process.cwd();

await buildApis({
  kind: "OpenAPI",
  sourceDirectory: path.join(
    PROJECT_ROOT,
    "definition",
    "apis",
    "openApis"
  ),
  outputDirectory: path.join(
    PROJECT_ROOT,
    "publication",
    "apis",
    "openApis"
  ),
  rootExtension: "openapi.yaml",
  bundledExtension: "openapi.yaml",
  bundle: bundleOpenApi,
  generateHtml: generateOpenApiHtml,
});