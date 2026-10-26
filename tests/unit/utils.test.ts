import { expect, it } from "vitest";
import { cn } from "@/lib/utils";

it("merges conditional class inputs and resolves Tailwind conflicts", () => {
  expect(cn("px-2 text-sm", ["px-4"], { hidden: false, block: true }, null, undefined))
    .toBe("text-sm px-4 block");
  expect(cn()).toBe("");
});
