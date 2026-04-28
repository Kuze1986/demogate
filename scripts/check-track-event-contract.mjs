import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const eventTypesPath = path.join(root, "types", "events.ts");
const trackRoutePath = path.join(root, "app", "api", "track-event", "route.ts");

const mustContainEvents = [
  "video_view_start",
  "video_watch_50",
  "module_complete",
  "demo_complete",
  "cta_click",
];

const [eventTypes, trackRoute] = await Promise.all([
  readFile(eventTypesPath, "utf8"),
  readFile(trackRoutePath, "utf8"),
]);

const missing = [];
for (const eventName of mustContainEvents) {
  if (!eventTypes.includes(`"${eventName}"`)) {
    missing.push(`types/events.ts missing "${eventName}"`);
  }
  if (!trackRoute.includes(`"${eventName}"`)) {
    missing.push(`app/api/track-event/route.ts missing "${eventName}"`);
  }
}

if (!trackRoute.includes("metadata")) {
  missing.push("track-event route should persist metadata payload");
}

if (missing.length > 0) {
  console.error("[check:telemetry] Contract check failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("[check:telemetry] Telemetry contract looks good.");
