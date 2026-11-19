import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

/** Allow-list matching what the editor can produce. Everything else (scripts, styles, event handlers, images) is dropped. */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"],
  allowedAttributes: { a: ["href", "title", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }) },
};

export const sanitizeDocHtml = (html: string) => sanitizeHtml(html, OPTIONS).trim();

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const IMPORT_EXTENSIONS = ["txt", "md", "docx"] as const;

export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Imported document";
}

export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Converts an uploaded file to sanitized editor HTML. Throws a user-readable Error for unsupported input. */
export async function importToHtml(filename: string, bytes: Buffer): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (bytes.length > MAX_IMPORT_BYTES) throw new Error("Files are limited to 2 MB.");
  if (bytes.length === 0) throw new Error("That file is empty.");
  if (ext === "txt") return sanitizeDocHtml(textToHtml(bytes.toString("utf8")));
  if (ext === "md") return sanitizeDocHtml(await marked.parse(bytes.toString("utf8"), { async: true }));
  if (ext === "docx") {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error("That doesn't look like a Word (.docx) file.");
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer: bytes });
    return sanitizeDocHtml(value);
  }
  throw new Error("Only .txt, .md and .docx files can be imported.");
}
