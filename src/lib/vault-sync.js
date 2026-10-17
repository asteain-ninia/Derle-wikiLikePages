import { checkPublication } from "./content-import.js";

export const NOTE_FILE = /\.(md|wiki|txt)$/i;
export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg)$/i;

// ファイル名が「別のファイル名の一部」ではなく、それ自体として書かれているか。
// 「大地図.png」と書いてあっても「地図.png」は参照していないとみなす
const FILE_NAME_BOUNDARY = /[\s[|=:/(（「『>"'*]/;

function mentionsFileName(text, fileName) {
  let index = text.indexOf(fileName);
  while (index !== -1) {
    if (index === 0 || FILE_NAME_BOUNDARY.test(text[index - 1])) {
      return true;
    }
    index = text.indexOf(fileName, index + 1);
  }
  return false;
}

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
    return publishedNotes.some((note) => mentionsFileName(note.text, fileName));
  });

  return {
    files: [...publishedNotes.map((note) => note.path), ...images].sort(),
    publishedNoteCount: publishedNotes.length,
    imageCount: images.length,
    unreadableNotes,
  };
}
