// Minimal local proxy for DeepSeek API (CommonJS for Node by default)
// Run with: node server.js
// Requires environment variable: DEEPSEEK_API_KEY

const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
  console.warn(
    "[deepseek-proxy] Warning: DEEPSEEK_API_KEY is not set. Requests will fail."
  );
} else {
  console.log("[deepseek-proxy] DEEPSEEK_API_KEY is set (length:", DEEPSEEK_API_KEY.length, ")");
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "*";

  // Basic CORS headers for dev
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/chat") {
    console.log("[deepseek-proxy] Incoming /chat request");
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Missing DEEPSEEK_API_KEY on proxy server. Set it before running."
        })
      );
      return;
    }

    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          const data = JSON.stringify(payload);

          const urlObj = new URL(DEEPSEEK_API_URL);

          const options = {
            method: "POST",
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data),
              Authorization: `Bearer ${DEEPSEEK_API_KEY}`
            }
          };

          const apiReq = https.request(options, (apiRes) => {
            let responseData = "";
            apiRes.on("data", (chunk) => {
              responseData += chunk;
            });
            apiRes.on("end", () => {
              res.writeHead(apiRes.statusCode || 500, {
                "Content-Type": apiRes.headers["content-type"] || "application/json"
              });
              res.end(responseData);
            });
          });

          apiReq.on("error", (error) => {
            console.error("[deepseek-proxy] Error forwarding request:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Failed to forward request to DeepSeek API."
              })
            );
          });

          apiReq.write(data);
          apiReq.end();
        } catch (err) {
          console.error("[deepseek-proxy] Error handling request:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Unexpected server error."
            })
          );
        }
      });
    } catch (err) {
      console.error("[deepseek-proxy] Unexpected error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unexpected server error."
        })
      );
    }

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[deepseek-proxy] Listening on http://localhost:${PORT}/chat`);
});

