import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, pathExists } from "../../core/utils/fs-utils.js";
import { generateSchemaReleaseNotes } from "../../releasenotes/diff-schemas-release-notes.js";
import { writeReleaseNotes } from "../../releasenotes/write-release-notes.js";

export async function diffSchemas(name: string, fromVersion: string, toVersion: string): Promise<void> {
  const previousYamlPath = path.join(PATHS.publishedSchemas, name, `${name}_v${fromVersion}.schema.yaml`);
  const nextYamlPath = path.join(PATHS.publishedSchemas, name, `${name}_v${toVersion}.schema.yaml`);
  if (!(await pathExists(previousYamlPath))) throw new Error(`Schema version not found: ${previousYamlPath}`);
  if (!(await pathExists(nextYamlPath))) throw new Error(`Schema version not found: ${nextYamlPath}`);
  const releaseNotes = await generateSchemaReleaseNotes(name, fromVersion, toVersion, previousYamlPath, nextYamlPath);
  const outputDir = path.join(PATHS.diffSchemas, name);
  await ensureDirectory(outputDir);
  await writeReleaseNotes(outputDir, `${name}_v${fromVersion}_to_v${toVersion}.diff`, releaseNotes);
}
