import path from "node:path";

const PROJECT_ROOT = process.cwd();

/**
 * Centralized project paths.
 *
 * Notes:
 * - "published-current" contains the latest non-versioned published artifacts
 * - "published-version" contains immutable versioned published artifacts
 */
export const PATHS = {
  projectRoot: PROJECT_ROOT,

  definitionSchemasModels: path.join(
    PROJECT_ROOT,
    "definition",
    "schemas",
    "models"
  ),

  definitionOpenApis: path.join(
    PROJECT_ROOT,
    "definition",
    "apis",
    "openApis"
  ),

  definitionAsyncApis: path.join(
    PROJECT_ROOT,
    "definition",
    "apis",
    "asyncApis"
  ),

  publishedCurrentSchemas: path.join(
    PROJECT_ROOT,
    "published-current",
    "schemas"
  ),

  publishedCurrentApis: path.join(
    PROJECT_ROOT,
    "published-current",
    "apis"
  ),

  publishedVersionApis: path.join(
    PROJECT_ROOT,
    "published-version",
    "apis"
  ),

  publishedCurrentOpenApis: path.join(
    PROJECT_ROOT,
    "published-current",
    "apis",
    "openApis"
  ),

  publishedCurrentAsyncApis: path.join(
    PROJECT_ROOT,
    "published-current",
    "apis",
    "asyncApis"
  ),

  publishedVersionSchemas: path.join(
    PROJECT_ROOT,
    "published-version",
    "schemas"
  ),

  publishedVersionOpenApis: path.join(
    PROJECT_ROOT,
    "published-version",
    "apis",
    "openApis"
  ),

  publishedVersionAsyncApis: path.join(
    PROJECT_ROOT,
    "published-version",
    "apis",
    "asyncApis"
  ),
};
