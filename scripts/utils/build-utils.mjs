import fs from "node:fs/promises";

/**
 * Returns true if a file or directory exists.
 *
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a directory if it does not already exist.
 *
 * @param {string} directoryPath
 * @returns {Promise<void>}
 */
export async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

/**
 * Returns the names of all direct subdirectories.
 *
 * @param {string} directoryPath
 * @returns {Promise<string[]>}
 */
export async function getDirectSubdirectoryNames(directoryPath) {
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Returns the optional artifact name passed on the command line.
 *
 * Examples:
 * - node scripts/build-schemas.mjs
 * - node scripts/build-schemas.mjs enforcementRecord
 *
 * @returns {string | null}
 */
export function getRequestedArtifactName() {
  return process.argv[2] ?? null;
}
