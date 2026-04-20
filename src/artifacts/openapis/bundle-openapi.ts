import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runNpx(args: string[]): Promise<void> {
  await execFileAsync(process.platform === "win32" ? "npx.cmd" : "npx", args, { cwd: process.cwd() });
}

export async function bundleOpenApi(rootFilePath: string, outputFilePath: string): Promise<void> {
  await runNpx(["@redocly/cli", "bundle", rootFilePath, "--output", outputFilePath]);
}

export async function buildOpenApiHtml(inputFilePath: string, outputFilePath: string): Promise<void> {
  await runNpx(["@redocly/cli", "build-docs", inputFilePath, "--output", outputFilePath]);
}
