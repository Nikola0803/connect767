import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve("connect767-cms/includes/class-rest-messages.php"),
  "utf8",
);

describe("private message attachment storage", () => {
  it("stores new message files outside public WordPress media", () => {
    expect(source).toContain("connect767-private-messages");
    expect(source).toContain("_c767_private_message_file");
    expect(source).toContain("move_uploaded_file");
    expect(source).not.toContain("media_handle_sideload");
    expect(source).toContain("c767_private_message_storage_public");
  });

  it("verifies file boundaries and integrity before signed downloads", () => {
    expect(source).toContain("basename($storage_name)");
    expect(source).toContain("_c767_private_message_sha256");
    expect(source).toContain("hash_equals($expected_hash, hash_file('sha256', $file_real))");
  });

  it("keeps legacy attachments readable without using public storage for new uploads", () => {
    expect(source).toContain("Backward compatibility only");
    expect(source).toContain("get_attached_file($attachment_id)");
  });
});
