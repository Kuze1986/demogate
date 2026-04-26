/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const path = require("path");

// Next standalone binds `process.env.HOSTNAME || "0.0.0.0"`. Docker/Railway set HOSTNAME to the
// container hostname; that breaks binding on all interfaces for the edge proxy.
delete process.env.HOSTNAME;
process.env.HOSTNAME = "0.0.0.0";

const port = process.env.PORT || "";
console.error(
  `[demoforge] starting standalone (PORT=${port || "unset"} HOSTNAME=${process.env.HOSTNAME})`
);

require(path.join(__dirname, "..", ".next", "standalone", "server.js"));
