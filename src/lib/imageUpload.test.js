import { describe, expect, it } from "vitest";
import {
  coverPhotoDimensionError,
  coverPhotoFileError,
  formatFileSize,
  MAX_COVER_PHOTO_BYTES,
} from "./imageUpload";

describe("cover photo validation", () => {
  it("accepts a supported image within the server limit", () => {
    expect(coverPhotoFileError({ type: "image/jpeg", size: MAX_COVER_PHOTO_BYTES })).toBe("");
  });

  it("explains when the selected image exceeds the 2 MB server limit", () => {
    const message = coverPhotoFileError({ type: "image/png", size: 2.5 * 1024 * 1024 });
    expect(message).toMatch(/2\.5 MB/i);
    expect(message).toMatch(/maximum upload size is 2 MB/i);
  });

  it("rejects image formats WordPress cannot reliably display", () => {
    expect(coverPhotoFileError({ type: "image/heic", size: 1000 })).toMatch(/JPG, PNG, WebP, or GIF/i);
  });

  it("rejects damaged and excessively large-dimension images", () => {
    expect(coverPhotoDimensionError(0, 0)).toMatch(/damaged/i);
    expect(coverPhotoDimensionError(9000, 5000)).toMatch(/too large to process/i);
    expect(coverPhotoDimensionError(2000, 2000)).toBe("");
  });

  it("formats sizes in a user-friendly way", () => {
    expect(formatFileSize(2621440)).toBe("2.5 MB");
  });
});
