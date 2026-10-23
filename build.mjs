import { readFile, mkdir, writeFile } from "node:fs/promises";

const root = new URL(".", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const [template, css, engine, app, favicon] = await Promise.all([
  read("index.html"), read("style.css"), read("engine.js"), read("app.js"), read("favicon.svg"),
]);

// Keep this small, dependency-free app usable by opening a single local file.
const importLine = 'import { TypingSession, parseHistory } from "./engine.js";';
if (!app.startsWith(importLine)) throw new Error("Unexpected application imports; update the standalone build.");
const script = `${engine.replace(/^export /gm, "")}\n${app.slice(importLine.length)}`
  .replaceAll("</script", "<\\/script");
const html = template
  .replace('<link rel="stylesheet" href="style.css" />', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script type="module">\n${script}\n</script>`)
  .replace('href="favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`)
  .replace('class="brand" href="./"', 'class="brand" href="#"');
if (html.includes('src="app.js"') || html.includes('href="style.css"')) throw new Error("Standalone build still has external assets.");
await mkdir(new URL("dist/", root), { recursive: true });
await writeFile(new URL("dist/typegarden.html", root), html);
await writeFile(new URL("dist/index.html", root), html);
await writeFile(new URL("dist/.nojekyll", root), "");
console.log("Created dist/index.html for web publishing and dist/typegarden.html for local use.");
