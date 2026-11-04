import type { PictureCrop, PictureSource } from "#lib/application/profile/types.js";

/** The closest zoom: the square then shows a quarter of the source's shorter side. */
export const maxZoom = 4;

/** The largest side, in pixels, of the picture the profile service stores. */
const maxPictureSide = 512;

/** The side of the square a zoom keeps, in source pixels. */
export function cropSide(source: PictureSource, zoom: number): number {
  return Math.min(source.width, source.height) / zoom;
}

/** Keeps the whole source's center, at the zoom that fits its shorter side in the square. */
export function centeredCrop(source: PictureSource): PictureCrop {
  const side = cropSide(source, 1);
  return { zoom: 1, x: (source.width - side) / 2, y: (source.height - side) / 2 };
}

/** Moves the image under the square by a distance given in fractions of the square's side. */
export function panCrop(source: PictureSource, crop: PictureCrop, dx: number, dy: number): PictureCrop {
  const side = cropSide(source, crop.zoom);
  return coverSquare(source, { ...crop, x: crop.x - dx * side, y: crop.y - dy * side });
}

/**
 * Zooms within bounds around a focus point, given in fractions of the square's side: the source pixel
 * under it stays there. The center of the square is the default focus.
 */
export function zoomCrop(source: PictureSource, crop: PictureCrop, zoom: number, focusX = 0.5, focusY = 0.5) {
  const nextZoom = Math.min(maxZoom, Math.max(1, zoom));
  const side = cropSide(source, crop.zoom);
  const nextSide = cropSide(source, nextZoom);
  const x = crop.x + focusX * (side - nextSide);
  const y = crop.y + focusY * (side - nextSide);
  return coverSquare(source, { zoom: nextZoom, x, y });
}

/** The side, in pixels, of the picture a crop saves: the source pixels it keeps, up to the service's limit. */
export function pictureSide(source: PictureSource, crop: PictureCrop): number {
  return Math.max(1, Math.min(maxPictureSide, Math.round(cropSide(source, crop.zoom))));
}

/**
 * Places the source under the square, in percentages of the square's side: its width and the
 * offsets of its top-left corner.
 */
export function imagePlacement(source: PictureSource, crop: PictureCrop) {
  const side = cropSide(source, crop.zoom);
  return {
    width: (source.width / side) * 100,
    left: (-crop.x / side) * 100,
    top: (-crop.y / side) * 100,
  };
}

/** Keeps the square inside the source, so the image always covers it. */
function coverSquare(source: PictureSource, crop: PictureCrop): PictureCrop {
  const side = cropSide(source, crop.zoom);
  return {
    zoom: crop.zoom,
    x: Math.min(source.width - side, Math.max(0, crop.x)),
    y: Math.min(source.height - side, Math.max(0, crop.y)),
  };
}
