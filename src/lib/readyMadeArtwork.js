export const ARTWORK_MAX_FILES = 10;
export const ARTWORK_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ARTWORK_MAX_TOTAL_BYTES = 3 * 1024 * 1024;
export const ARTWORK_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export function artworkType(file) {
  if (file.type) return file.type;
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" })[file.name?.split(".").pop()?.toLowerCase()] || "";
}

export function readyMadeArtworkIssue(files = [], items) {
  if (!Array.isArray(files) || files.length > ARTWORK_MAX_FILES) return "Attach up to 10 team and sponsor files.";
  if (files.some((file) => !ARTWORK_TYPES.includes(artworkType(file)))) return "Choose PNG, JPG, WebP or PDF files.";
  if (files.some((file) => !Number.isFinite(file.size) || file.size <= 0 || file.size > ARTWORK_MAX_FILE_BYTES)) return "Each file must be non-empty and no larger than 2 MB.";
  if (files.reduce((sum, file) => sum + file.size, 0) > ARTWORK_MAX_TOTAL_BYTES) return "Keep the combined team and sponsor files under 3 MB.";
  if (items && files.some((file) => file.productSlug && !items.some((item) => item.slug === file.productSlug))) return "Choose a current design for each attached file, or select All designs.";
  return "";
}

export function readReadyMadeArtwork(file, kind) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const type = artworkType(file);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}. Please try again.`));
    reader.onload = () => resolve({
      id: crypto.randomUUID(), name: file.name.slice(0, 160), type, size: file.size,
      src: reader.result, kind, productSlug: "", notes: "",
    });
    reader.readAsDataURL(new Blob([file], { type }));
  });
}

let database;
function artworkDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("c767-ready-made-artwork", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => { database = null; throw error; });
  return database;
}

export async function readArtworkDraft(key) {
  const db = await artworkDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").get(key);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error);
  });
}

export async function writeArtworkDraft(key, files) {
  const db = await artworkDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    if (files.length) transaction.objectStore("drafts").put(files, key);
    else transaction.objectStore("drafts").delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
