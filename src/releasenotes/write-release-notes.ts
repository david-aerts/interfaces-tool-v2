import path from "node:path";
import { writeJsonFile } from "../core/utils/json-utils.js";
import { writeTextFile } from "../core/utils/fs-utils.js";
import { renderReleaseNotesHtml, renderReleaseNotesMarkdown } from "./render-release-notes.js";
import { ReleaseNotes } from "./release-note-types.js";

export async function writeReleaseNotes(outputDirectoryPath: string, fileBaseName: string, releaseNotes: ReleaseNotes): Promise<void> {
  await writeJsonFile(path.join(outputDirectoryPath, `${fileBaseName}.json`), releaseNotes);
  await writeTextFile(path.join(outputDirectoryPath, `${fileBaseName}.md`), renderReleaseNotesMarkdown(releaseNotes));
  await writeTextFile(path.join(outputDirectoryPath, `${fileBaseName}.html`), renderReleaseNotesHtml(releaseNotes));
}
