// Runs `tsc --noEmit` and fails only on type errors outside the files that already failed when this fork started
// (inherited from upstream at bb34830). Remove a file from the list once its errors are fixed.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const KNOWN_FAILING_FILES = [
  "src/main/integrations/last-fm/index.ts",
  "src/main/integrations/last-fm/last-fm-client/index.ts",
  "src/main/integrations/companion-server/api-shared/auth.ts"
];

const require = createRequire(import.meta.url);
// TypeScript 7 no longer exports its bin, so resolve it from package.json, which every version exports
const typescriptPackageJson = require.resolve("typescript/package.json", { paths: [process.cwd()] });
const tsc = path.join(path.dirname(typescriptPackageJson), require(typescriptPackageJson).bin.tsc);
const result = spawnSync(process.execPath, [tsc, "--noEmit", "-p", "."], { encoding: "utf8" });
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const errors = output.split(/\r?\n/).filter(line => line.includes("error TS"));
const fresh = errors.filter(line => !KNOWN_FAILING_FILES.some(file => line.replaceAll("\\", "/").startsWith(file)));

for (const line of fresh) console.log(line);
console.log(`tsc: ${errors.length} errors, ${fresh.length} outside the known failing files`);
process.exit(fresh.length === 0 ? 0 : 1);
