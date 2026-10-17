import test from "node:test";
import assert from "node:assert/strict";

import { selectPublishedFiles } from "../src/lib/vault-sync.js";

test("selectPublishedFiles keeps only 公開: true notes and the images they mention", () => {
  const notes = [
    { path: "国/公開国.md", text: "---\n種別: 国\n公開: true\n---\n![[公開地図.png]]\n{{基礎情報 国\n|位置画像=位置.png\n}}" },
    { path: "下書き.md", text: "---\n種別: 国\n---\n> [!caution] 未査読\n![[下書き地図.png]]" },
    { path: "壊れ.md", text: '---\n"公開": true\n---\n本文' },
  ];
  const images = ["画像/公開地図.png", "画像/位置.png", "画像/下書き地図.png", "未使用.jpg"];

  assert.deepEqual(selectPublishedFiles(notes, images), {
    files: ["国/公開国.md", "画像/位置.png", "画像/公開地図.png"],
    publishedNoteCount: 1,
    imageCount: 2,
    unreadableNotes: ["壊れ.md"],
  });
});
