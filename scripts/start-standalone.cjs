"use strict";
const path = require("path");

// Next standalone binds `process.env.HOSTNAME || "0.0.0.0"`. Docker/Railway set
// HOSTNAME to the container id, so the HTTP server does not listen on all interfaces
// and the edge proxy reports ECONNREFUSED (502).
delete process.env.HOSTNAME;

require(path.join(__dirname, "..", ".next", "standalone", "server.js"));
