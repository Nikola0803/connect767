import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import seoPages from "../data/seo-pages.json";

const SITE_URL = "https://connect767.com";
const SOCIAL_IMAGE = `${SITE_URL}/connect767-favicon.png`;
const DEFAULT_META = seoPages["/"];
const NOINDEX_PREFIXES = [
  "/auth/",
  "/checkout",
  "/dashboard",
  "/saved",
  "/listings/submit",
  "/shop/customize",
];

function pageMeta(pathname) {
  if (seoPages[pathname]) return seoPages[pathname];
  if (/^\/listings\/[^/]+$/.test(pathname)) {
    return {
      title: "Directory Profile | Connect767",
      description: "View this business or professional profile in Connect767’s Dominican online directory.",
      label: "Directory Profile",
    };
  }
  if (/^\/shop\/[^/]+$/.test(pathname)) {
    return {
      title: "Shop Product | Connect767",
      description: "View product details, available options and secure checkout information in the Connect767 Shop.",
      label: "Shop Product",
    };
  }
  if (/^\/blog\/[^/]+$/.test(pathname)) {
    return {
      title: "Connect767 Business Story",
      description: "Read stories and practical guidance from the Connect767 community.",
      label: "Article",
    };
  }
  return DEFAULT_META;
}

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

function setStructuredData(pathname, meta, canonical) {
  let script = document.head.querySelector("#connect767-route-schema");
  if (!script) {
    script = document.createElement("script");
    script.id = "connect767-route-schema";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }

  const graph = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Connect767",
      description: DEFAULT_META.description,
    },
  ];

  if (pathname === "/") {
    graph.push({
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Connect767",
      url: `${SITE_URL}/`,
      logo: SOCIAL_IMAGE,
      description: DEFAULT_META.description,
      email: "info@connect767.com",
      telephone: "+1-862-253-2076",
    });
  } else {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Connect767", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: meta.label, item: canonical },
      ],
    });
  }

  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

export default function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname !== "/" ? pathname.replace(/\/$/, "") : "/";
    const meta = pageMeta(normalizedPath);
    const canonical = `${SITE_URL}${normalizedPath === "/" ? "/" : normalizedPath}`;
    const noindex = NOINDEX_PREFIXES.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    );

    document.title = meta.title;
    setMeta('meta[name="description"]', { name: "description", content: meta.description });
    setMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    });
    setMeta('meta[property="og:title"]', { property: "og:title", content: meta.title });
    setMeta('meta[property="og:description"]', {
      property: "og:description",
      content: meta.description,
    });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    setMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Connect767" });
    setMeta('meta[property="og:image"]', { property: "og:image", content: SOCIAL_IMAGE });
    setMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "512" });
    setMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "512" });
    setMeta('meta[property="og:image:alt"]', {
      property: "og:image:alt",
      content: "Connect767 C logo",
    });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary" });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: meta.title });
    setMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: meta.description,
    });
    setCanonical(canonical);
    setStructuredData(normalizedPath, meta, canonical);
  }, [pathname]);

  return null;
}
