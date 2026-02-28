require("./instrument.js");

const { start: startHealthServer } = require("./healthServer.js");

/**
 * AIPipeline — entry point.
 * If PORT is set, starts health HTTP server (GET /health, GET /). Otherwise returns app name.
 */
function main() {
  return "AIPipeline";
}

module.exports = { main };

if (require.main === module) {
  const port = process.env.PORT;
  if (port) {
    startHealthServer()
      .then((server) => {
        const addr = server.address();
        const portNum = typeof addr === "object" && addr ? addr.port : port;
        console.log(`Health server listening on port ${portNum}`);
      })
      .catch((err) => {
        console.error("Health server failed:", err.message);
        process.exitCode = 1;
      });
  } else {
    console.log(main());
  }
}
