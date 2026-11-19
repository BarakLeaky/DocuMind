import { describe, expect, it } from "vitest";
import { describeWait, evaluateLimit } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-19T12:00:00Z");

describe("evaluateLimit", () => {
  it("allows requests under the limit and reports what is left", () => {
    const r = evaluateLimit({ count: 3, limit: 5, oldest: null, windowMs: HOUR, now });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });
  it("blocks at the limit and says when the oldest event leaves the window", () => {
    const oldest = new Date(now.getTime() - 40 * 60 * 1000); // 40 minutes ago
    const r = evaluateLimit({ count: 5, limit: 5, oldest, windowMs: HOUR, now });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBe(20 * 60);
  });
  it("never returns a wait shorter than one second", () => {
    const oldest = new Date(now.getTime() - HOUR);
    expect(evaluateLimit({ count: 9, limit: 5, oldest, windowMs: HOUR, now }).retryAfterSeconds).toBe(1);
  });
});

describe("describeWait", () => {
  it("speaks in plain units", () => {
    expect(describeWait(30)).toBe("a minute");
    expect(describeWait(20 * 60)).toBe("20 minutes");
    expect(describeWait(3600)).toBe("an hour");
  });
});