import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cmsRoot = path.join(process.cwd(), "connect767-cms");

function phpFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return phpFiles(target);
    return entry.name.endsWith(".php") ? [target] : [];
  });
}

describe("Connect767 email branding", () => {
  it("keeps every direct wp_mail call behind the shared notification renderer", () => {
    const directMailFiles = phpFiles(cmsRoot)
      .filter((file) => /\bwp_mail\s*\(/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(cmsRoot, file).replaceAll("\\", "/"));

    expect(directMailFiles).toEqual(["includes/class-notifications.php"]);
  });

  it("uses the shared template for account, quote, message, and commerce mail", () => {
    const notifications = fs.readFileSync(
      path.join(cmsRoot, "includes/class-notifications.php"),
      "utf8",
    );
    expect(notifications).toContain('data-c767-email="1"');
    expect(notifications).toContain("Connect767 Directory");
    expect(notifications).toContain("brand_outgoing_mail");
    expect(notifications).toContain("woocommerce_email_styles");

    for (const file of [
      "class-rest-messages.php",
      "class-rest-product-quotes.php",
      "class-rest-uniform-quotes.php",
    ]) {
      expect(
        fs.readFileSync(path.join(cmsRoot, "includes", file), "utf8"),
      ).toContain("C767_Notifications::send_branded_mail");
    }
  });
});
