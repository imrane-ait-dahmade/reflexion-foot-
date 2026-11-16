import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("joins and merges Tailwind classes", () => {
    expect(cn("a", false, undefined, "b", null, "c")).toBe("a b c");
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
