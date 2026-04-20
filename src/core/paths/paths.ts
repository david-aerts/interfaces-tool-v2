import path from "node:path";

const root = process.cwd();

export const PATHS = {
  projectRoot: root,

  definitionSchemasCommon: path.join(root, "definition", "schemas", "common"),
  definitionSchemasRoots: path.join(root, "definition", "schemas", "roots"),
  definitionOpenApis: path.join(root, "definition", "openapis"),
  definitionAsyncApis: path.join(root, "definition", "asyncapis"),

  buildRoot: path.join(root, "build"),

  currentRoot: path.join(root, "build", "current"),
  currentSchemas: path.join(root, "build", "current", "schemas"),
  currentOpenApis: path.join(root, "build", "current", "openapis"),
  currentAsyncApis: path.join(root, "build", "current", "asyncapis"),
  currentSummary: path.join(root, "build", "current", "summary.html"),

  publishedRoot: path.join(root, "build", "published"),
  publishedSchemas: path.join(root, "build", "published", "schemas"),
  publishedOpenApis: path.join(root, "build", "published", "openapis"),
  publishedAsyncApis: path.join(root, "build", "published", "asyncapis"),
  publishedSummary: path.join(root, "build", "published", "summary.html"),

  diffRoot: path.join(root, "build", "diff"),
  diffSchemas: path.join(root, "build", "diff", "schemas"),
  diffOpenApis: path.join(root, "build", "diff", "openapis"),
  diffAsyncApis: path.join(root, "build", "diff", "asyncapis"),
};
