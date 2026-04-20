import fs from "node:fs/promises";
import path from "node:path";
import { readYamlFile, writeYamlFile } from "../../core/utils/yaml-utils.js";
import { pathExists } from "../../core/utils/fs-utils.js";
import { PATHS } from "../../core/paths/paths.js";
import { compareVersions } from "../../core/utils/version-utils.js";

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function walkObject(node: any, visitor: (node: any) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkObject(item, visitor);
    return;
  }
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const value of Object.values(node)) walkObject(value, visitor);
}

async function getLatestPublishedSchemaVersion(schemaName: string): Promise<string | null> {
  const schemaDirectory = path.join(PATHS.publishedSchemas, schemaName);
  if (!(await pathExists(schemaDirectory))) return null;
  const entries = await fs.readdir(schemaDirectory, { withFileTypes: true });
  const versions = entries.filter(e=>e.isFile()).map(e=>e.name).map(fileName=>{
    const match = fileName.match(new RegExp(`^${schemaName}_v(\\d+\\.\\d+\\.\\d+)\\.schema\\.(yaml|json)$`));
    return match ? match[1] : null;
  }).filter(Boolean) as string[];
  if (versions.length===0) return null;
  return [...new Set(versions)].sort(compareVersions).at(-1) ?? null;
}

async function inspectSchemaRef(apiDefinitionPath: string, refValue: string) {
  if (refValue.startsWith("#")) return { type: "internal" as const };
  const apiDirectory = path.dirname(apiDefinitionPath);
  const absoluteRefPath = path.resolve(apiDirectory, refValue);

  if (isPathInside(PATHS.currentSchemas, absoluteRefPath)) {
    const relative = toPosixPath(path.relative(PATHS.currentSchemas, absoluteRefPath));
    const match = relative.match(/^([^/]+)\/([^/]+)\.schema\.(yaml|json)$/);
    if (!match || match[1] !== match[2]) throw new Error(`Invalid current schema ref "${refValue}".`);
    return { type: "floating" as const, schemaName: match[1], extension: match[3] as "yaml"|"json" };
  }
  if (isPathInside(PATHS.publishedSchemas, absoluteRefPath)) {
    const relative = toPosixPath(path.relative(PATHS.publishedSchemas, absoluteRefPath));
    const match = relative.match(/^([^/]+)\/([^/]+)_v(\d+\.\d+\.\d+)\.schema\.(yaml|json)$/);
    if (!match || match[1] !== match[2]) throw new Error(`Invalid published schema ref "${refValue}".`);
    if (!(await pathExists(absoluteRefPath))) throw new Error(`Pinned published schema ref does not exist: ${refValue}`);
    return { type: "pinned" as const };
  }
  throw new Error(`Invalid external schema ref "${refValue}". API definitions may only reference build/current/schemas or build/published/schemas.`);
}

export async function prepareAsyncApiSource(apiDefinitionPath: string, mode: "build" | "publish"): Promise<string> {
  const apiDefinition = await readYamlFile<any>(apiDefinitionPath);
  const cloned = JSON.parse(JSON.stringify(apiDefinition));
  const apiDirectory = path.dirname(apiDefinitionPath);
  const pendingNodes: any[] = [];
  walkObject(cloned, (node) => {
    if (node && typeof node === "object" && typeof node.$ref === "string") pendingNodes.push(node);
  });

  for (const node of pendingNodes) {
    const refValue = node.$ref as string;
    const inspection = await inspectSchemaRef(apiDefinitionPath, refValue);
    if (inspection.type === "internal" || inspection.type === "pinned") continue;
    if (mode === "build") {
      continue;
    }
    const latestSchemaVersion = await getLatestPublishedSchemaVersion(inspection.schemaName!);
    if (!latestSchemaVersion) throw new Error(`Schema "${inspection.schemaName}" is referenced by the API but has no published version yet.`);
    const targetFilePath = path.join(PATHS.publishedSchemas, inspection.schemaName!, `${inspection.schemaName}_v${latestSchemaVersion}.schema.${inspection.extension}`);
    node.$ref = toPosixPath(path.relative(apiDirectory, targetFilePath));
  }

  const tempFilePath = path.join(apiDirectory, `.${path.basename(apiDefinitionPath, ".yaml")}.prepared.yaml`);
  await writeYamlFile(tempFilePath, cloned);
  return tempFilePath;
}
