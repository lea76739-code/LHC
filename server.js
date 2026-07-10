const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || __dirname);
const port = Number(process.argv[3] || process.env.PORT || 50033);
const host = process.argv[4] || process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function staticPath(urlPath) {
  const pathname = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath);
  const file = path.resolve(path.join(root, pathname));
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");

  const file = staticPath(url.pathname);
  if (!file) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`http://127.0.0.1:${port}/index.html`);
});
