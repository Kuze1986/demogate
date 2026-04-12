import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin tracing root so `output: "standalone"` emits `.next/standalone/server.js`
// (avoids nested paths when a parent lockfile makes Next infer the wrong monorepo root).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
