import { checkPublication } from "./content-import.js";

export const NOTE_FILE = /\.(md|wiki|txt)$/i;
export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg)$/i;

// 保管庫のファイル一覧から、content/ にコピーするものを決める。
// - 原稿: frontmatter に `公開: true` があるものだけ
// - 画像: 公開する原稿のどれかにファイル名が書かれているものだけ
//   (![[地図.png]]・[[File:地図.png]]・インフォボックスの 位置画像=地図.png など書き方を問わない)
// notes は { path, text }、imagePaths は保管庫からの相対パス (区切りは /)。
export function selectPublishedFiles(notes, imagePaths) {
  const publishedNotes = [];
  const unreadableNotes = [];

  for (const note of notes) {
    const { published, unreadable } = checkPublication(note.text);
    if (published) {
      publishedNotes.push(note);
    } else if (unreadable) {
      unreadableNotes.push(note.path);
    }
  }

  const images = imagePaths.filter((imagePath) => {
    const fileName = imagePath.split("/").pop();
    return publishedNotes.some((note) => note.text.includes(fileName));
  });

  return {
    files: [...publishedNotes.map((note) => note.path), ...images].sort(),
    publishedNoteCount: publishedNotes.length,
    imageCount: images.length,
    unreadableNotes,
  };
}
