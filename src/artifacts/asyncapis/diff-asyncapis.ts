import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, pathExists } from "../../core/utils/fs-utils.js";
import { generateAsyncApiReleaseNotes } from "../../releasenotes/diff-asyncapis-release-notes.js";
import { writeReleaseNotes } from "../../releasenotes/write-release-notes.js";

export async function diffAsyncApis(name: string, fromVersion: string, toVersion: string): Promise<void> {
  const previousYamlPath = path.join(PATHS.publishedAsyncApis, name, `${name}_v${fromVersion}.asyncapi.yaml`);
  const nextYamlPath = path.join(PATHS.publishedAsyncApis, name, `${name}_v${toVersion}.asyncapi.yaml`);
  if (!(await pathExists(previousYamlPath))) throw new Error(`AsyncAPI version not found: ${previousYamlPath}`);
  if (!(await pathExists(nextYamlPath))) throw new Error(`AsyncAPI version not found: ${nextYamlPath}`);
  const releaseNotes = await generateAsyncApiReleaseNotes(name, fromVersion, toVersion, previousYamlPath, nextYamlPath);
  const outputDir = path.join(PATHS.diffAsyncApis, name);
  await ensureDirectory(outputDir);
  await writeReleaseNotes(outputDir, `${name}_v${fromVersion}_to_v${toVersion}.diff`, releaseNotes);
}
