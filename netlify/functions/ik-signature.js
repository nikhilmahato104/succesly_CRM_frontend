const https = require("https");

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, csrf-token, x-ik-cookie",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const csrfToken = event.headers["csrf-token"] || "";
  const ikCookie  = event.headers["x-ik-cookie"]  || "";
  const body      = event.body || "";
  const bodyBuf   = Buffer.from(body, "utf8");

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "imagekit.io",
        port: 443,
        path: "/api/clients/54DZYShIdN/upload/signature/v2",
        method: "POST",
        headers: {
          "content-type":   "application/json",
          "content-length": bodyBuf.byteLength,
          "origin":         "https://imagekit.io",
          "referer":        "https://imagekit.io/dashboard/media-library",
          "csrf-token":     csrfToken,
          "cookie":         ikCookie,
          "user-agent":     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
          "accept":         "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: data,
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: `Proxy error: ${err.message}` }),
      });
    });

    req.write(bodyBuf);
    req.end();
  });
};
