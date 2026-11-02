import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(__dirname, path), "utf8").replace(/\r\n/g, "\n");

describe("protocol", () => {
  it("is identical on the server and the client", () => {
    expect(read("../../web/src/protocol.ts")).toBe(read("../src/protocol.ts"));
  });
});
