const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "EM",
  "H2",
  "H3",
  "I",
  "IMG",
  "LI",
  "OL",
  "P",
  "STRONG",
  "UL",
]);

const GLOBAL_ATTRIBUTES = new Set(["aria-label"]);
const TAG_ATTRIBUTES = {
  A: new Set(["href", "target", "title"]),
  IMG: new Set(["alt", "height", "src", "title", "width"]),
};

function isSafeUrl(value, { image = false } = {}) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../") || url.startsWith("#")) {
    return true;
  }
  try {
    const parsed = new URL(url, "https://connect767.com");
    const allowed = image ? ["http:", "https:"] : ["http:", "https:", "mailto:"];
    return allowed.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeElement(element) {
  for (const child of [...element.children]) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      sanitizeElement(child);
      child.replaceWith(...child.childNodes);
      continue;
    }

    const allowedAttributes = TAG_ATTRIBUTES[child.tagName] || new Set();
    for (const attribute of [...child.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || (!GLOBAL_ATTRIBUTES.has(name) && !allowedAttributes.has(name))) {
        child.removeAttribute(attribute.name);
      }
    }

    if (child.tagName === "A") {
      if (!isSafeUrl(child.getAttribute("href"))) child.removeAttribute("href");
      if (child.getAttribute("target") !== "_blank") child.removeAttribute("target");
      if (child.getAttribute("target") === "_blank") child.setAttribute("rel", "noopener noreferrer");
    }

    if (child.tagName === "IMG" && !isSafeUrl(child.getAttribute("src"), { image: true })) {
      child.remove();
      continue;
    }

    sanitizeElement(child);
  }
}

/**
 * Sanitizes editorial HTML before React inserts it into the document.
 * This allowlist intentionally supports only the markup used by blog posts.
 */
export function sanitizeHtml(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  if (typeof DOMParser === "undefined") return "";

  const document = new DOMParser().parseFromString(value, "text/html");
  for (const blocked of document.body.querySelectorAll("script, style, iframe, object, embed, form, input, button, svg, math")) {
    blocked.remove();
  }
  sanitizeElement(document.body);
  return document.body.innerHTML;
}
