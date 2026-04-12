import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
const staticSrc = join(root, ".next", "static");
const publicSrc = join(root, "public");

if (!existsSync(standalone)) {
  console.warn("[postbuild-standalone] No .next/standalone output; skipping.");
  process.exit(0);
}

if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(standalone, "public"), { recursive: true });
}

if (existsSync(staticSrc)) {
  mkdirSync(join(standalone, ".next", "static"), { recursive: true });
  cpSync(staticSrc, join(standalone, ".next", "static"), { recursive: true });
}

console.log("[postbuild-standalone] Copied public + .next/static into standalone bundle.");
