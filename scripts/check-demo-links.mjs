const baseUrl = process.env.CHECK_BASE_URL ?? "http://localhost:3999";

const paths = ["/", "/demo", "/billing", "/admin/login", "/api/health"];

async function checkPath(pathname) {
  const url = new URL(pathname, baseUrl).toString();
  try {
    const response = await fetch(url, { redirect: "follow" });
    return { pathname, ok: response.ok, status: response.status };
  } catch (error) {
    return {
      pathname,
      ok: false,
      status: "network-error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = await Promise.all(paths.map(checkPath));
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  console.log(
    `[check:demo-links] ${result.pathname} -> ${result.status}${result.ok ? "" : " (failed)"}`
  );
}

if (failures.length > 0) {
  console.error("[check:demo-links] One or more required routes failed.");
  process.exit(1);
}

console.log("[check:demo-links] All required routes responded successfully.");
