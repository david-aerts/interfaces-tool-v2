
import { generateApiReleaseNotes, writeApiReleaseNotes } from "./api-release-notes-engine.mjs";

export async function generateAsyncApiReleaseNotes(
  artifactName,
  fromVersion,
  toVersion,
  previousYamlPath,
  nextYamlPath
) {
  return generateApiReleaseNotes({
    artifactType: "asyncapi",
    artifactName,
    fromVersion,
    toVersion,
    previousYamlPath,
    nextYamlPath,
  });
}

export async function writeAsyncApiReleaseNotes(outputDirectoryPath, fileBaseName, releaseNotes) {
  return writeApiReleaseNotes(outputDirectoryPath, fileBaseName, releaseNotes);
}
