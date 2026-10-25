import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pages = JSON.parse(await fs.readFile(path.join(root, "src/data/seo-pages.json"), "utf8"));
const homeHtml = await fs.readFile(path.join(dist, "index.html"), "utf8");
const siteUrl = "https://connect767.com";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function structuredData(route, meta, canonical) {
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: "Connect767",
      description: pages["/"].description,
    },
  ];

  if (route === "/") {
    graph.push({
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Connect767",
      url: `${siteUrl}/`,
      logo: `${siteUrl}/connect767-favicon.png`,
      description: pages["/"].description,
      email: "info@connect767.com",
      telephone: "+1-862-253-2076",
    });
  } else {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Connect767", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: meta.label, item: canonical },
      ],
    });
  }

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll(
    "<",
    "\\u003c",
  );
}

function render(html, route, meta) {
  const canonical = `${siteUrl}${route === "/" ? "/" : route}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      "</head>",
      `    <meta name="robots" content="index, follow, max-image-preview:large" />\n` +
        `    <link rel="canonical" href="${canonical}" />\n` +
        `    <meta property="og:title" content="${title}" />\n` +
        `    <meta property="og:description" content="${description}" />\n` +
        `    <meta property="og:url" content="${canonical}" />\n` +
        `    <meta property="og:type" content="website" />\n` +
        `    <meta property="og:site_name" content="Connect767" />\n` +
        `    <meta property="og:image" content="${siteUrl}/connect767-favicon.png" />\n` +
        `    <meta property="og:image:width" content="512" />\n` +
        `    <meta property="og:image:height" content="512" />\n` +
        `    <meta property="og:image:alt" content="Connect767 C logo" />\n` +
        `    <meta name="twitter:card" content="summary" />\n` +
        `    <meta name="twitter:title" content="${title}" />\n` +
        `    <meta name="twitter:description" content="${description}" />\n` +
        `    <script id="connect767-route-schema" type="application/ld+json">${structuredData(route, meta, canonical)}</script>\n` +
        "  </head>",
    );
}

for (const [route, meta] of Object.entries(pages)) {
  const html = render(homeHtml, route, meta);
  if (route === "/") {
    await fs.writeFile(path.join(dist, "index.html"), html);
    continue;
  }
  const directory = path.join(dist, route.slice(1));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}

console.log(`Generated ${Object.keys(pages).length} search-optimized HTML entry points.`);
