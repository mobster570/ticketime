import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("merges multiple class strings", () => {
    expect(cn("foo", "bar", "baz")).toBe("foo bar baz");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, null, undefined, 0 as unknown as string, "bar")).toBe("foo bar");
  });

  it("merges conflicting Tailwind classes, last one wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("m-2", "mx-4")).toBe("m-2 mx-4");
  });

  it("returns an empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles a single class string", () => {
    expect(cn("only-class")).toBe("only-class");
  });

  it("handles array inputs (clsx-style)", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn(["foo", false && "bar"])).toBe("foo");
  });

  it("handles object inputs (clsx-style)", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("handles mixed strings, arrays, and objects", () => {
    expect(cn("base", ["conditional", false && "gone"], { active: true, disabled: false })).toBe(
      "base conditional active",
    );
  });
});
