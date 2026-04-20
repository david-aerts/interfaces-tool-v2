import fs from "node:fs/promises";
import yaml from "js-yaml";

export async function readYamlFile<T = any>(filePath: string): Promise<T> {
  return yaml.load(await fs.readFile(filePath, "utf8")) as T;
}

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  const content = yaml.dump(value, { noRefs: true, lineWidth: -1 });
  await fs.writeFile(filePath, content, "utf8");
}
