// 画像ファイルの先頭を読んで縦横の大きさ (ピクセル) を返す。読めない形式は null。
// 記事の画像に width / height を付けて、読み込み前から場所を空けておくのに使う
// (遅延読み込みの画像が後から伸びて、見出しへ移動した位置がずれるのを防ぐ)。

function readPngSize(bytes) {
  // 署名 8 バイトのあとの IHDR に幅・高さ (ビッグエンディアン 4 バイトずつ)
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47 || bytes.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readGifSize(bytes) {
  if (bytes.length < 10 || bytes.toString("ascii", 0, 3) !== "GIF") {
    return null;
  }
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

function readJpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // 長さを持たないマーカー
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += marker === 0xff ? 1 : 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    // SOF0〜SOF15 (DHT 0xC4・JPG 0xC8・DAC 0xCC を除く) に高さ・幅がある
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpSize(bytes) {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === "VP8 ") {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

export function readImageSize(bytes) {
  const size = readPngSize(bytes) ?? readJpegSize(bytes) ?? readGifSize(bytes) ?? readWebpSize(bytes);
  return size && size.width > 0 && size.height > 0 ? size : null;
}
