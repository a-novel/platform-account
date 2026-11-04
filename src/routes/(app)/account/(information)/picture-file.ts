import type { PictureCrop, PictureSource } from "#lib/application/profile/types.js";

import { cropSide, pictureSide } from "./crop";

/** The largest picture the profile service stores, in bytes. */
const maxPictureBytes = 256 * 1024;

/** The quality a picture is encoded at first, then the lower ones it tries until it fits the service's limit. */
const bestQuality = 0.9;
const lowerQualities = [0.8, 0.7, 0.6, 0.5];

/** The browser side of the picture dialog: decoding a chosen file and encoding the framed picture. */
export interface PictureFiles {
  /** Decodes an image file the browser can open. Throws when it cannot. */
  open(file: Blob): Promise<PictureSource>;
  /** Draws the framed square and encodes it for the profile service. */
  encode(source: PictureSource, crop: PictureCrop): Promise<Blob>;
  /** Frees a source the dialog no longer shows. */
  release(source: PictureSource): void;
}

/** Reads and writes pictures with the browser's image decoder and canvas. */
export const browserPictureFiles: PictureFiles = {
  async open(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await decode(url);
      return { url, width: image.naturalWidth, height: image.naturalHeight };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  },
  async encode(source, crop) {
    const side = pictureSide(source, crop);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser has no 2D canvas.");
    // JPEG has no transparency, and a transparent image shows its fill everywhere alike.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, side, side);
    context.imageSmoothingQuality = "high";
    const kept = cropSide(source, crop.zoom);
    context.drawImage(await decode(source.url), crop.x, crop.y, kept, kept, 0, 0, side, side);

    return await encodeWithin(canvas);
  },
  release(source) {
    URL.revokeObjectURL(source.url);
  },
};

async function decode(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/**
 * Encodes a canvas as WebP, or as JPEG where the browser cannot encode WebP, at the best quality
 * that fits the service's limit. A picture still over it at the lowest quality goes as is, and the
 * service refuses it.
 */
async function encodeWithin(canvas: HTMLCanvasElement): Promise<Blob> {
  let type = "image/webp";
  let picture = await toBlob(canvas, type, bestQuality);
  // Safari encodes no WebP: it answers with a PNG instead.
  if (picture.type !== type) {
    type = "image/jpeg";
    picture = await toBlob(canvas, type, bestQuality);
  }

  for (const quality of lowerQualities) {
    if (picture.size <= maxPictureBytes) break;
    picture = await toBlob(canvas, type, quality);
  }
  return picture;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not encode the picture."))),
      type,
      quality
    );
  });
}
