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

export function explicitSizeChart(gallery = []) {
  return (
    gallery.find((image) => image?.isSizeChart) ||
    gallery.find((image) => EXPLICIT_CHART_NAME.test(`${image?.name || ""} ${image?.src || ""}`)) ||
    null
  );
}

export async function detectLegacySizeChart(gallery = [], description = "") {
  const explicit = explicitSizeChart(gallery);
  if (explicit || !SIZE_GUIDE_REFERENCE.test(description)) return explicit;

  const dimensions = await Promise.all(
    gallery.filter((image) => image?.src).map((image) => loadImageDimensions(image.src))
  );
  const chart = dimensions
    .filter((image) => image.height > 0 && image.width / image.height >= 2.5)
    .sort((a, b) => b.width / b.height - a.width / a.height)[0];

  return chart ? gallery.find((image) => image.src === chart.src) || null : null;
}
