import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runNpx(args: string[]): Promise<void> {
  await execFileAsync(process.platform === "win32" ? "npx.cmd" : "npx", args, { cwd: process.cwd() });
}

export async function bundleAsyncApi(rootFilePath: string, outputFilePath: string): Promise<void> {
  await runNpx(["@asyncapi/cli", "bundle", rootFilePath, "--output", outputFilePath]);
}

export async function buildAsyncApiHtml(inputFilePath: string, outputDirectory: string, outputFileName: string): Promise<void> {
  await runNpx(["@asyncapi/cli", "generate", "fromTemplate", inputFilePath, "@asyncapi/html-template@3.5.4", "-o", outputDirectory, "--force-write", "-p", "singleFile=true", "-p", `outFilename=${outputFileName}`]);
}
