/**
 * Lecture des dimensions d'une image, sans dépendance externe.
 *
 * On ne décode que l'en-tête : PNG (IHDR), JPEG (SOF0…SOF15), GIF (descripteur
 * logique, avec détection d'animation) et WebP (VP8, VP8L, VP8X). Tout autre
 * format est refusé par `inspectImage`.
 */

export type ImageSize = {
  width: number;
  height: number;
  format: "png" | "jpeg" | "gif" | "webp";
  animated: boolean;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPng(bytes: Buffer): ImageSize | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height, format: "png", animated: false };
}

function readJpeg(bytes: Buffer): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // SOF0..SOF15, sauf DHT (C4), JPG (C8) et DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      if (width && height) return { width, height, format: "jpeg", animated: false };
      return null;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function readGif(bytes: Buffer): ImageSize | null {
  if (bytes.length < 10) return null;
  const header = bytes.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = bytes.readUInt16LE(6);
  const height = bytes.readUInt16LE(8);
  if (!width || !height) return null;
  // Un GIF animé répète plusieurs blocs Image Descriptor : on compte les
  // séparateurs 0x2C au début de bloc, hors sous-blocs.
  let animated = false;
  let offset = 13;
  const globalFlag = bytes[10];
  if (globalFlag & 0x80) offset += 3 * 2 ** ((globalFlag & 0x07) + 1);
  let frames = 0;
  while (offset < bytes.length) {
    const block = bytes[offset];
    if (block === 0x3b) break; // trailer
    if (block === 0x21) {
      offset += 2;
      while (offset < bytes.length && bytes[offset] !== 0) offset += bytes[offset] + 1;
      offset += 1;
      continue;
    }
    if (block === 0x2c) {
      frames += 1;
      if (frames > 1) {
        animated = true;
        break;
      }
      offset += 10;
      const flags = bytes[offset - 1];
      if (flags & 0x80) offset += 3 * 2 ** ((flags & 0x07) + 1);
      offset += 1; // LZW minimum code size
      while (offset < bytes.length && bytes[offset] !== 0) offset += bytes[offset] + 1;
      offset += 1;
      continue;
    }
    break;
  }
  return { width, height, format: "gif", animated };
}

function readWebp(bytes: Buffer): ImageSize | null {
  if (bytes.length < 30) return null;
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8 ") {
    const width = bytes.readUInt16LE(26) & 0x3fff;
    const height = bytes.readUInt16LE(28) & 0x3fff;
    return width && height ? { width, height, format: "webp", animated: false } : null;
  }
  if (kind === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height, format: "webp", animated: false };
  }
  if (kind === "VP8X") {
    const width = 1 + bytes.readUIntLE(24, 3);
    const height = 1 + bytes.readUIntLE(27, 3);
    const animated = Boolean(bytes[20] & 0x02);
    return { width, height, format: "webp", animated };
  }
  return null;
}

/** Dimensions et format, ou `null` si le contenu n'est pas une image reconnue. */
export function readSize(bytes: Buffer): ImageSize | null {
  return readPng(bytes) ?? readJpeg(bytes) ?? readGif(bytes) ?? readWebp(bytes);
}
