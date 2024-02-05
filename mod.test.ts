import { encode, decode } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.214.0/assert/mod.ts";

Deno.test("zip and unzip", async (t) => {
  await t.step("text files", async () => {
    const obj = {
      "file1.txt": new Uint8Array([72, 69, 76, 76, 79]),
      "file2.txt": new Uint8Array([72, 69, 76, 76, 79]),
    };

    assertEquals(await decode(await encode(obj)), obj);
  });

  await t.step("UTF-8 filename", async () => {
    const obj = {
      "ファイル.txt": new Uint8Array([72, 69, 76, 76, 79]),
      "✅☺👍.txt": new Uint8Array([72, 69, 76, 76, 79]),
    };

    assertEquals(await decode(await encode(obj)), obj);
  });
  await t.step("test", async () => {

    console.log(await decode(await Deno.readFile("test.apkg")));
  });
});
