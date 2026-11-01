const SIZE_GUIDE_REFERENCE = /\b(size\s*(chart|guide)|sizing|measurement)\b/i;
const EXPLICIT_CHART_NAME = /(size[-_\s]*(chart|guide)|sizing[-_\s]*chart|measurement)/i;

function loadImageDimensions(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ src, width: 0, height: 0 });
    image.src = src;
  });
}

function hasSizeAttribute(attributes = []) {
  return attributes.some((attribute) => {
    const name = String(attribute?.name || "")
      .replace(/^pa[_-]?/i, "")
      .trim();
    return /^(size|sizes|sizing)$/i.test(name);
  });
}

export function explicitSizeChart(gallery = []) {
  return (
    gallery.find((image) => image?.isSizeChart) ||
    gallery.find((image) => EXPLICIT_CHART_NAME.test(`${image?.name || ""} ${image?.src || ""}`)) ||
    null
  );
}

export async function detectLegacySizeChart(gallery = [], description = "", attributes = []) {
  const explicit = explicitSizeChart(gallery);
  const mayHaveUnlabelledChart =
    SIZE_GUIDE_REFERENCE.test(description) || hasSizeAttribute(attributes);
  if (explicit || !mayHaveUnlabelledChart) return explicit;

  const dimensions = await Promise.all(
    gallery
      .filter((image) => image?.src)
      .map((image) =>
        image.width > 0 && image.height > 0
          ? Promise.resolve({ src: image.src, width: image.width, height: image.height })
          : loadImageDimensions(image.src)
      )
  );
  const chart = dimensions
    .filter((image) => image.height > 0 && image.width / image.height >= 2.5)
    .sort((a, b) => b.width / b.height - a.width / a.height)[0];

  return chart ? gallery.find((image) => image.src === chart.src) || null : null;
}
