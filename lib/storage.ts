import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Object storage interface. Files live in Postgres (`file_objects`) so the app runs anywhere with a single
 * database. To move to S3 / R2 / Vercel Blob, implement this same interface and export it as `storage`.
 */
export interface DocumentStorage {
  createUploadTarget(tenantKey: string, ext: string): { key: string; uploadUrl: string; expiresAt: Date };
  verifyUploadSignature(key: string, exp: number, sig: string): boolean;
  putObject(key: string, data: Buffer): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  deleteObjects(keys: string[]): Promise<void>;
}

const KEY_RE = /^[a-z0-9_-]{4,64}\/[a-f0-9-]{36}(\.[a-z0-9]{1,8})?$/;

function secret() {
  const s = process.env.STORAGE_SIGNING_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("STORAGE_SIGNING_SECRET must be set in production.");
  return "local-development-secret";
}

const sign = (key: string, exp: number) => createHmac("sha256", secret()).update(`${key}.${exp}`).digest("hex");

export const safeTenant = (t: string) => t.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64) || "tenant";

function assertKey(key: string) {
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
  return key;
}

export const storage: DocumentStorage = {
  createUploadTarget(tenantKey, ext) {
    // Opaque key: never derived from the original filename.
    const key = `${safeTenant(tenantKey)}/${randomUUID()}${ext ? `.${ext}` : ""}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const exp = Math.floor(expiresAt.getTime() / 1000);
    return { key, expiresAt, uploadUrl: `/api/v1/uploads/${key}?exp=${exp}&sig=${sign(key, exp)}` };
  },
  verifyUploadSignature(key, exp, sig) {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(sign(key, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  },
  async putObject(key, data) {
    assertKey(key);
    await getDb()
      .insert(schema.fileObjects)
      .values({ key, data, sizeBytes: data.length })
      .onConflictDoUpdate({ target: schema.fileObjects.key, set: { data, sizeBytes: data.length } });
  },
  async getObject(key) {
    assertKey(key);
    const [row] = await getDb().select({ data: schema.fileObjects.data }).from(schema.fileObjects).where(eq(schema.fileObjects.key, key)).limit(1);
    if (!row) throw new Error("Object not found");
    return Buffer.from(row.data);
  },
  async exists(key) {
    assertKey(key);
    const [row] = await getDb().select({ key: schema.fileObjects.key }).from(schema.fileObjects).where(eq(schema.fileObjects.key, key)).limit(1);
    return Boolean(row);
  },
  async deleteObjects(keys) {
    if (keys.length === 0) return;
    await getDb().delete(schema.fileObjects).where(inArray(schema.fileObjects.key, keys));
  },
};

export type DetectedType = { mime: string; ext: string } | null;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Detect the real file type from magic bytes instead of trusting the browser-supplied MIME. */
export function detectFileType(buf: Buffer): DetectedType {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    // Any zip starts with PK. A Word file is a zip that contains word/document.xml.
    return buf.includes("word/document.xml") ? { mime: DOCX_MIME, ext: "docx" } : null;
  }
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  if (sample.length > 0 && !sample.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(sample);
      return { mime: "text/plain", ext: "txt" };
    } catch {
      return null;
    }
  }
  return null;
}

export const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  [DOCX_MIME]: "docx",
  "text/plain": "txt",
};
