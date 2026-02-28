/**
 * Health server test: GET /health returns JSON, GET / returns 200.
 */
const http = require("http");
const { start } = require("../src/healthServer");

async function run() {
  const server = await start(0); // port 0 = OS chooses free port
  const actualPort = server.address().port;

  try {
    const health = await get(`http://127.0.0.1:${actualPort}/health`);
    if (health.ok !== true || !health.timestamp || health.service !== "aipipeline") {
      console.error("GET /health: unexpected body", health);
      process.exit(1);
    }

    const root = await getText(`http://127.0.0.1:${actualPort}/`);
    if (root !== "AIPipeline") {
      console.error("GET /: unexpected body", root);
      process.exit(1);
    }

    const status = await get(`http://127.0.0.1:${actualPort}/status`);
    if (status.ok !== true || !status.env || typeof status.n8n !== "string") {
      console.error("GET /status: unexpected body", status);
      process.exit(1);
    }

    const notFound = await getStatus(`http://127.0.0.1:${actualPort}/unknown`);
    if (notFound !== 404) {
      console.error("GET /unknown: expected 404, got", notFound);
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function getText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function getStatus(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      resolve(res.statusCode);
      res.resume();
    }).on("error", reject);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
