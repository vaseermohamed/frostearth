import { describe, expect, it } from "vitest";
import { splitIntoScriptRuns } from "@/lib/services/watermark/scriptRuns";

describe("splitIntoScriptRuns", () => {
  it("splits mixed Latin/Tamil/Devanagari text into per-script runs", () => {
    expect(splitIntoScriptRuns("Ravi ரவி रवि")).toEqual([
      { script: "latin", text: "Ravi " },
      { script: "tamil", text: "ரவி" },
      { script: "latin", text: " " },
      { script: "devanagari", text: "रवि" },
    ]);
  });

  it("never splits a surrogate pair", () => {
    const runs = splitIntoScriptRuns("a😀b");
    expect(runs).toEqual([{ script: "latin", text: "a😀b" }]);
  });

  it("returns no runs for an empty string", () => {
    expect(splitIntoScriptRuns("")).toEqual([]);
  });
});
