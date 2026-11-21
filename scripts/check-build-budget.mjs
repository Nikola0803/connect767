import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const limits = {
  javascriptGzip: 200 * 1024,
  cssGzip: 60 * 1024,
  image: 3.5 * 1024 * 1024,
};

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(fullPath));
    else output.push(fullPath);
  }
  return output;
}

const files = await walk(dist);
const warnings = [];
for (const file of files) {
  const extension = path.extname(file).toLowerCase();
  const contents = await fs.readFile(file);
  const relative = path.relative(dist, file).replaceAll("\\", "/");
  if (extension === ".js" && gzipSync(contents).length > limits.javascriptGzip) {
    warnings.push(`${relative}: JavaScript exceeds 200 KB gzip`);
  }
  if (extension === ".css" && gzipSync(contents).length > limits.cssGzip) {
    warnings.push(`${relative}: CSS exceeds 60 KB gzip`);
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".avif"].includes(extension) && contents.length > limits.image) {
    warnings.push(`${relative}: image exceeds 3.5 MB`);
  }
}

if (warnings.length) {
  console.warn("\nPerformance budget warnings:\n- " + warnings.join("\n- "));
  if (process.env.CI_BUDGET_STRICT === "1") process.exitCode = 1;
} else {
  console.log("Performance budgets passed.");
}
