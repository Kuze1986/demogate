// Next standalone uses `process.env.HOSTNAME || '0.0.0.0'`. Docker/Railway set HOSTNAME
// to the container id, so the server binds only there and the proxy gets 502.
process.env.HOSTNAME = "0.0.0.0";
