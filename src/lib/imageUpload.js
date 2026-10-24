export const MAX_COVER_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_COVER_PHOTO_PIXELS = 40_000_000;

const supportedCoverTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function coverPhotoFileError(file) {
  if (!file) return "Choose a cover photo to continue.";
  if (!supportedCoverTypes.has(file.type)) {
    return "This image format is not supported. Choose a JPG, PNG, WebP, or GIF image.";
  }
  if (!file.size) {
    return "This image appears to be empty or damaged. Choose a different picture.";
  }
  if (file.size > MAX_COVER_PHOTO_BYTES) {
    return `This cover photo is ${formatFileSize(file.size)}. The maximum upload size is 2 MB. Compress or resize it, then try again.`;
  }
  return "";
}

export function coverPhotoDimensionError(width, height) {
  if (!width || !height) {
    return "We couldn't read this image. It may be damaged or use an unsupported format. Choose a different picture.";
  }
  if (width * height > MAX_COVER_PHOTO_PIXELS) {
    return `This image is ${width} × ${height}px and is too large to process reliably. Resize it below 40 megapixels, then try again.`;
  }
  return "";
}

export function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(previewUrl);
      resolve(dimensions);
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Image could not be decoded."));
    };
    image.src = previewUrl;
  });
}
