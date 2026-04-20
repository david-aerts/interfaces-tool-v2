import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, pathExists } from "../../core/utils/fs-utils.js";
import { generateOpenApiReleaseNotes } from "../../releasenotes/diff-openapis-release-notes.js";
import { writeReleaseNotes } from "../../releasenotes/write-release-notes.js";

export async function diffOpenApis(name: string, fromVersion: string, toVersion: string): Promise<void> {
  const previousYamlPath = path.join(PATHS.publishedOpenApis, name, `${name}_v${fromVersion}.openapi.yaml`);
  const nextYamlPath = path.join(PATHS.publishedOpenApis, name, `${name}_v${toVersion}.openapi.yaml`);
  if (!(await pathExists(previousYamlPath))) throw new Error(`OpenAPI version not found: ${previousYamlPath}`);
  if (!(await pathExists(nextYamlPath))) throw new Error(`OpenAPI version not found: ${nextYamlPath}`);
  const releaseNotes = await generateOpenApiReleaseNotes(name, fromVersion, toVersion, previousYamlPath, nextYamlPath);
  const outputDir = path.join(PATHS.diffOpenApis, name);
  await ensureDirectory(outputDir);
  await writeReleaseNotes(outputDir, `${name}_v${fromVersion}_to_v${toVersion}.diff`, releaseNotes);
}
