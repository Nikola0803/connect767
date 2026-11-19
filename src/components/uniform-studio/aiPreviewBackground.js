export const AI_PREVIEW_BACKGROUND_FALLBACK = "#f5f0e7";

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function edgeColorFromImageData(imageData, fallback = AI_PREVIEW_BACKGROUND_FALLBACK) {
  const { data, width, height } = imageData || {};
  if (!data?.length || !width || !height) return fallback;

  const patch = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 4)));
  const red = [];
  const green = [];
  const blue = [];
  const corners = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + patch; y += 1) {
      for (let x = startX; x < startX + patch; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 200) continue;
        red.push(data[offset]);
        green.push(data[offset + 1]);
        blue.push(data[offset + 2]);
      }
    }
  }

  if (!red.length) return fallback;
  return `rgb(${median(red)}, ${median(green)}, ${median(blue)})`;
}

export function sampleImageEdgeColor(image, fallback = AI_PREVIEW_BACKGROUND_FALLBACK) {
  if (!image?.naturalWidth || !image?.naturalHeight || typeof document === "undefined") return fallback;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return fallback;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return edgeColorFromImageData(context.getImageData(0, 0, canvas.width, canvas.height), fallback);
  } catch {
    return fallback;
  }
}
