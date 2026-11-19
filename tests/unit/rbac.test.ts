import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, roleFromClerk } from "@/lib/rbac";

describe("rbac", () => {
  it("owner has every permission", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
  });
  it("admin cannot manage billing", () => {
    expect(can("admin", "billing.manage")).toBe(false);
    expect(can("admin", "members.manage")).toBe(true);
  });
  it("reader can read and query but not upload or delete", () => {
    expect(can("reader", "document.read")).toBe(true);
    expect(can("reader", "assistant.query")).toBe(true);
    expect(can("reader", "document.upload")).toBe(false);
    expect(can("reader", "document.delete")).toBe(false);
  });
  it("auditor only reads audit records", () => {
    expect(can("auditor", "audit.read")).toBe(true);
    expect(can("auditor", "document.read")).toBe(false);
  });
  it("unknown Clerk roles fall back to least privilege", () => {
    expect(roleFromClerk("org:something_new")).toBe("reader");
    expect(roleFromClerk(undefined)).toBe("reader");
    expect(roleFromClerk("org:admin")).toBe("admin");
  });
  it("only roles that author content can create docs", () => {
    expect(can("contributor", "doc.edit")).toBe(true);
    expect(can("reader", "doc.edit")).toBe(false);
    expect(can("auditor", "doc.edit")).toBe(false);
  });
});
