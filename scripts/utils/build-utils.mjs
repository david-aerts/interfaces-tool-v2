// scripts/utils/build-utils.mjs

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