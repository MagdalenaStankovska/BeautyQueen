// Serves the e2e frontend build with single-page-app fallback.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", ".build");
const types = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css",
    ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon", ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
    let file = path.normalize(path.join(root, decodeURIComponent(req.url.split("?")[0])));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.E2E_WEB_PORT) || 3100, () => console.log("e2e web ready"));
