import { stripTypeScriptTypes } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "src");
const outputRoot = join(root, "dist", "src");
async function buildDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const sourcePath = join(directory, entry.name);
    if (entry.isDirectory()) { await buildDirectory(sourcePath); continue; }
    if (!entry.name.endsWith(".ts")) continue;
    const outputPath = join(outputRoot, relative(sourceRoot, sourcePath).replace(/\.ts$/, ".js"));
    await mkdir(dirname(outputPath), { recursive: true });
    const source = await readFile(sourcePath, "utf8");
    const javascript = stripTypeScriptTypes(source, { mode: "transform" })
      .replace(/(["'])(\.\.?\/[^"']+)\.ts\1/g, "$1$2.js$1");
    await writeFile(outputPath, javascript);
  }
}
await buildDirectory(sourceRoot);
