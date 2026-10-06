import { describe, expect, it } from "vitest";
import { attachmentContentDisposition } from "@/lib/utils/contentDisposition";

describe("attachmentContentDisposition", () => {
  it.each(["தமிழ் குறிப்புகள்.pdf", "हिंदी नोट्स.pdf", 'Notes (v2) "final".pdf', "Physics.pdf"])(
    "produces a header value the Headers API accepts for %s",
    (name) => {
      expect(() => new Headers({ "Content-Disposition": attachmentContentDisposition(name) })).not.toThrow();
    }
  );

  it("round-trips the real name through filename*", () => {
    const name = "தமிழ் குறிப்புகள்.pdf";
    const encoded = attachmentContentDisposition(name).split("filename*=UTF-8''")[1];
    expect(decodeURIComponent(encoded)).toBe(name);
  });

  it("falls back to an ASCII name that keeps the extension", () => {
    expect(attachmentContentDisposition("தமிழ்.pdf")).toContain('filename="download.pdf"');
    expect(attachmentContentDisposition("Physics.pdf")).toContain('filename="Physics.pdf"');
  });

  it("strips quotes and line breaks that could break the header", () => {
    const value = attachmentContentDisposition('a"b\r\nc.pdf');
    expect(value).toContain('filename="abc.pdf"');
    expect(value).not.toMatch(/[\r\n]/);
  });
});
