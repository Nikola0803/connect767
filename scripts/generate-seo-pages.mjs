import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pages = JSON.parse(await fs.readFile(path.join(root, "src/data/seo-pages.json"), "utf8"));
const homeHtml = await fs.readFile(path.join(dist, "index.html"), "utf8");
const siteUrl = "https://connect767.com";
const cmsUrl = "https://admin.connect767.com";
const privateRoutes = [
  "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password",
  "/checkout", "/checkout/thank-you", "/dashboard", "/messages", "/saved",
  "/shop/customize", "/design-studio",
];

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function plainText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&#8217;|&rsquo;/gi, "’").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ").trim();
}

function description(value, fallback) {
  const text = plainText(value);
  if (!text) return fallback;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

function validSlug(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Connect767-SEO-Build/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`SEO content request failed (${response.status}): ${url}`);
  return response.json();
}

async function loadPublicContent() {
  const [listings, posts, products] = await Promise.all([
    fetchJson(`${cmsUrl}/wp-json/wp/v2/listing?per_page=100&_fields=slug,modified,title,excerpt,acf`),
    fetchJson(`${cmsUrl}/wp-json/wp/v2/posts?per_page=100&_fields=slug,modified,title,excerpt`),
    fetchJson(`${cmsUrl}/wp-json/connect767/v1/shop/products?per_page=100`),
  ]);
  return { listings, posts, products };
}

function structuredData(route, meta, canonical) {
  const graph = [{
    "@type": "WebSite", "@id": `${siteUrl}/#website`, url: `${siteUrl}/`,
    name: "Connect767", description: pages["/"].description,
  }];
  if (route === "/") {
    graph.push({
      "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "Connect767",
      url: `${siteUrl}/`, logo: `${siteUrl}/connect767-favicon.png`,
      description: pages["/"].description, email: "info@connect767.com", telephone: "+1-862-253-2076",
    });
  } else {
    graph.push({
      "@type": meta.schemaType || "WebPage", "@id": `${canonical}#webpage`, url: canonical,
      name: meta.title, description: meta.description, isPartOf: { "@id": `${siteUrl}/#website` },
    });
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Connect767", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: meta.label, item: canonical },
      ],
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("<", "\\u003c");
}

function render(html, route, meta, { index = true } = {}) {
  const canonical = `${siteUrl}${route === "/" ? "/" : route}`;
  const title = escapeHtml(meta.title);
  const metaDescription = escapeHtml(meta.description);
  const robots = index ? "index, follow, max-image-preview:large" : "noindex, nofollow";
  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${metaDescription}" />`)
    .replace("</head>",
      `    <meta name="robots" content="${robots}" />\n` +
      `    <link rel="canonical" href="${canonical}" />\n` +
      `    <meta property="og:title" content="${title}" />\n` +
      `    <meta property="og:description" content="${metaDescription}" />\n` +
      `    <meta property="og:url" content="${canonical}" />\n` +
      `    <meta property="og:type" content="${meta.schemaType === "Article" ? "article" : "website"}" />\n` +
      `    <meta property="og:site_name" content="Connect767" />\n` +
      `    <meta property="og:image" content="${siteUrl}/connect767-favicon.png" />\n` +
      `    <meta property="og:image:width" content="512" />\n` +
      `    <meta property="og:image:height" content="512" />\n` +
      `    <meta property="og:image:alt" content="Connect767 C logo" />\n` +
      `    <meta name="twitter:card" content="summary" />\n` +
      `    <meta name="twitter:title" content="${title}" />\n` +
      `    <meta name="twitter:description" content="${metaDescription}" />\n` +
      `    <script id="connect767-route-schema" type="application/ld+json">${structuredData(route, meta, canonical)}</script>\n` +
      "  </head>");
}

async function writeRoute(route, meta, options) {
  const html = render(homeHtml, route, meta, options);
  if (route === "/") {
    await fs.writeFile(path.join(dist, "index.html"), html);
    return;
  }
  const directory = path.join(dist, route.slice(1));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}

function sitemapXml(entries) {
  const body = entries.map(({ route, modified }) => {
    const loc = escapeHtml(`${siteUrl}${route === "/" ? "/" : route}`);
    const lastmod = modified ? `<lastmod>${escapeHtml(modified.slice(0, 10))}</lastmod>` : "";
    return `  <url><loc>${loc}</loc>${lastmod}</url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const { listings, posts, products } = await loadPublicContent();
const publicEntries = Object.entries(pages).map(([route, meta]) => ({ route, meta }));

for (const listing of listings) {
  if (!validSlug(listing.slug)) continue;
  const name = plainText(listing.title?.rendered) || "Directory Profile";
  const excerpt = description(listing.excerpt?.rendered, `View ${name} in Connect767’s Dominican online directory.`);
  publicEntries.push({
    route: `/listings/${listing.slug}`, modified: listing.modified,
    meta: { title: `${name} | Connect767 Directory`, description: excerpt, label: name },
  });
  if (listing.acf?.sell_products === true || listing.acf?.sell_products === "1") {
    publicEntries.push({
      route: `/listings/${listing.slug}/shop`, modified: listing.modified,
      meta: {
        title: `${name} Storefront | Connect767`,
        description: `Shop products available from ${name} through the Connect767 marketplace.`,
        label: `${name} Storefront`,
      },
    });
  }
}

for (const post of posts) {
  if (!validSlug(post.slug)) continue;
  const name = plainText(post.title?.rendered) || "Connect767 Article";
  publicEntries.push({
    route: `/blog/${post.slug}`, modified: post.modified,
    meta: {
      title: `${name} | Connect767`,
      description: description(post.excerpt?.rendered, "Read stories and practical guidance from the Connect767 community."),
      label: name, schemaType: "Article",
    },
  });
}

for (const product of products) {
  if (!validSlug(product.slug)) continue;
  const name = plainText(product.name) || "Shop Product";
  publicEntries.push({
    route: `/shop/${product.slug}`, modified: product.date_modified || product.date_created,
    meta: {
      title: `${name} | Connect767 Shop`,
      description: description(product.short_description || product.description, `Shop ${name} and view available options through the Connect767 Shop.`),
      label: name, schemaType: "Product",
    },
  });
}

const uniquePublicEntries = [...new Map(publicEntries.map((entry) => [entry.route, entry])).values()];
for (const entry of uniquePublicEntries) await writeRoute(entry.route, entry.meta);

const privateMeta = { title: "Connect767 Account", description: "Private Connect767 account page.", label: "Account" };
for (const route of privateRoutes) await writeRoute(route, privateMeta, { index: false });
for (const listing of listings) {
  if (validSlug(listing.slug)) await writeRoute(`/listings/${listing.slug}/edit`, privateMeta, { index: false });
}

await fs.writeFile(path.join(dist, "sitemap.xml"), sitemapXml(uniquePublicEntries));
console.log(`Generated ${uniquePublicEntries.length} indexable HTML entry points, ${privateRoutes.length} private entry points, and a live-content sitemap.`);
