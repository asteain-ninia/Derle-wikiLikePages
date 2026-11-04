import test from "node:test";
import assert from "node:assert/strict";

import { readImageSize } from "../src/lib/image-size.js";

test("readImageSize は PNG の IHDR から縦横を読む", () => {
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  assert.deepEqual(readImageSize(png), { width: 640, height: 480 });
});

test("readImageSize は JPEG の SOF から縦横を読み、手前の APP 区画を飛ばす", () => {
  const jpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 (長さ 4)
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  assert.deepEqual(readImageSize(jpeg), { width: 640, height: 480 });
});

test("readImageSize は読めない形式に null を返す", () => {
  assert.equal(readImageSize(Buffer.from("<svg></svg>")), null);
  assert.equal(readImageSize(Buffer.alloc(0)), null);
});
