import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/engine.js", ["engine.js", "text/javascript; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);

http
  .createServer(async (req, res) => {
    const entry = files.get(new URL(req.url, "http://localhost").pathname);
    if (!entry) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const content = await readFile(path.join(root, entry[0]));
      res.writeHead(200, {
        "Content-Type": entry[1],
        "Cache-Control": "no-cache",
      });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end("Unable to read application file");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Type Garden running on port ${port}`),
  );
