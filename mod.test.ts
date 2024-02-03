import { encode, parse } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.214.0/assert/mod.ts";

Deno.test("parse - should return an object with file names and sizes", async () => {
  const obj = {
    "file1.txt": new Uint8Array([72, 69, 76, 76, 79]),
    "file2.txt": new Uint8Array([72, 69, 76, 76, 79]),
    // ... add more file names and data ...
  };
  const zip = await encode(obj);

  const result = await parse(new Uint8Array(zip));

  // Assert the expected output
  assertEquals(result, obj);
});
