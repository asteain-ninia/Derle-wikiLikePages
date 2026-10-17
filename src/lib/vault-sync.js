import { checkPublication } from "./content-import.js";

export const NOTE_FILE = /\.(md|wiki|txt)$/i;
export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg)$/i;

// 画像のパスやファイル名が、別の名前の一部ではなくそれ自体として書かれているか。前後の両方を確認する:
// - 直前は区切り文字のみ。/ は含めない (「別フォルダ/map.png」を map.png への参照とみなさない。
//   「大地図.png」も「地図.png」への参照ではない)
// - 直後は改行・閉じ括弧・区切り記号のみ。空白は含めない
//   (「map.png.webp」や「map.png draft.png」の途中で map.png に一致させない)
const NAME_START_BOUNDARY = /[\s[|=:(（「『>"'*]/;
const NAME_END_BOUNDARY = /[\r\n\t\]|)）」』<"'*#,、。;]/;

function mentions(text, needle) {
  let index = text.indexOf(needle);
  while (index !== -1) {
    const before = text[index - 1];
    const after = text[index + needle.length];
    if (
      (before === undefined || NAME_START_BOUNDARY.test(before)) &&
      (after === undefined || NAME_END_BOUNDARY.test(after))
    ) {
      return true;
    }
    index = text.indexOf(needle, index + 1);
  }
  return false;
}

// 画像が原稿から参照されているか。保管庫からのパス (画像/map.png) か、ファイル名だけ (map.png) で書かれていれば参照とみなす
function referencesImage(text, imagePath) {
  const fileName = imagePath.split("/").pop();
  return (imagePath !== fileName && mentions(text, imagePath)) || mentions(text, fileName);
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

  const images = imagePaths.filter((imagePath) =>
    publishedNotes.some((note) => referencesImage(note.text, imagePath))
  );

  return {
    files: [...publishedNotes.map((note) => note.path), ...images].sort(),
    publishedNoteCount: publishedNotes.length,
    imageCount: images.length,
    unreadableNotes,
  };
}
