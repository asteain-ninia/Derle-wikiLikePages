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

test("selectPublishedFiles does not treat a longer file name as a mention of a shorter one", () => {
  const notes = [{ path: "公開.md", text: "---\n公開: true\n---\n![[大地図.png]] と [[File:画像/位置.png|100px]] と |国旗画像=国旗.png" }];
  const images = ["地図.png", "大地図.png", "画像/位置.png", "国旗.png", "旗.png"];

  assert.deepEqual(selectPublishedFiles(notes, images).files, ["公開.md", "国旗.png", "大地図.png", "画像/位置.png"]);
});

test("selectPublishedFiles checks the boundary after the file name too", () => {
  const notes = [{ path: "公開.md", text: "---\n公開: true\n---\n![[map.png.webp]] と ![[river.png|川]]" }];
  assert.deepEqual(selectPublishedFiles(notes, ["map.png", "map.png.webp", "river.png"]).files, [
    "map.png.webp",
    "river.png",
    "公開.md",
  ]);
});

test("selectPublishedFiles distinguishes same-named images in different folders and names with spaces", () => {
  const notes = [{ path: "公開.md", text: "---\n公開: true\n---\n![[公開用/map.png]]\n![[river.png draft.png]]" }];
  const images = ["公開用/map.png", "非公開/map.png", "river.png", "river.png draft.png"];

  assert.deepEqual(selectPublishedFiles(notes, images).files, ["river.png draft.png", "公開.md", "公開用/map.png"]);
});
