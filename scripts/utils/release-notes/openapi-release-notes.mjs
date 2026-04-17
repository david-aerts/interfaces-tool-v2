
import { generateApiReleaseNotes, writeApiReleaseNotes } from "./api-release-notes-engine.mjs";

export async function generateOpenApiReleaseNotes(
  artifactName,
  fromVersion,
  toVersion,
  previousYamlPath,
  nextYamlPath
) {
  return generateApiReleaseNotes({
    artifactType: "openapi",
    artifactName,
    fromVersion,
    toVersion,
    previousYamlPath,
    nextYamlPath,
  });
}

export async function writeOpenApiReleaseNotes(outputDirectoryPath, fileBaseName, releaseNotes) {
  return writeApiReleaseNotes(outputDirectoryPath, fileBaseName, releaseNotes);
}
