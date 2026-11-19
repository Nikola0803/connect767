const CONNECT767_AI_LOGO = "/connect767-ai-logo-transparent.png?v=20261117";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be prepared."));
    image.src = src;
  });
}

function cornerBackground(data, width, height) {
  const sample = Math.max(2, Math.round(Math.min(width, height) * 0.025));
  const corners = [[0, 0], [width - sample, 0], [0, height - sample], [width - sample, height - sample]];
  let red = 0; let green = 0; let blue = 0; let count = 0;
  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sample; y += 1) {
      for (let x = startX; x < startX + sample; x += 1) {
        const index = (y * width + x) * 4;
        red += data[index]; green += data[index + 1]; blue += data[index + 2]; count += 1;
      }
    }
  }
  return [red / count, green / count, blue / count];
}

/**
 * Burns the Connect767 mark into only the flat background pixels. The garment
 * remains untouched, so the mark reads as part of the same backdrop and sits
 * visually behind the kit instead of on a separate canvas layer.
 */
export async function embossConnect767ConceptBackground(dataUrl) {
  if (!dataUrl || typeof document === "undefined" || typeof Image === "undefined") return dataUrl;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "")) return dataUrl;

  try {
    const [concept, logo] = await Promise.all([loadImage(dataUrl), loadImage(CONNECT767_AI_LOGO)]);
    const canvas = document.createElement("canvas");
    canvas.width = concept.naturalWidth || concept.width;
    canvas.height = concept.naturalHeight || concept.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return dataUrl;
    context.drawImage(concept, 0, 0, canvas.width, canvas.height);
    const original = context.getImageData(0, 0, canvas.width, canvas.height);
    const background = cornerBackground(original.data, canvas.width, canvas.height);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!maskContext) return dataUrl;
    const maxWidth = canvas.width * 0.72;
    const maxHeight = canvas.height * 0.82;
    const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;
    maskContext.drawImage(logo, (canvas.width - logoWidth) / 2, (canvas.height - logoHeight) / 2, logoWidth, logoHeight);
    const mask = maskContext.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = original.data;
    const offset = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 420));
    const alphaAt = (x, y) => {
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return 0;
      return mask[(y * canvas.width + x) * 4 + 3] / 255;
    };

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const distance = Math.hypot(
          pixels[index] - background[0],
          pixels[index + 1] - background[1],
          pixels[index + 2] - background[2],
        );
        if (distance > 28) continue;
        const centre = alphaAt(x, y);
        const highlight = alphaAt(x + offset, y + offset);
        const shadow = alphaAt(x - offset, y - offset);
        if (centre === 0 && highlight === 0 && shadow === 0) continue;
        const relief = ((highlight - shadow) * 26) - (centre * 2.5);
        pixels[index] = Math.max(0, Math.min(255, pixels[index] + relief));
        pixels[index + 1] = Math.max(0, Math.min(255, pixels[index + 1] + relief));
        pixels[index + 2] = Math.max(0, Math.min(255, pixels[index + 2] + relief));
      }
    }
    context.putImageData(original, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

