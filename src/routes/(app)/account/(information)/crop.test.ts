import { centeredCrop, cropSide, imagePlacement, maxZoom, panCrop, pictureSide, zoomCrop } from "./crop";

import { describe, expect, it } from "vitest";

const landscape = { url: "landscape.png", width: 1600, height: 900 };
const portrait = { url: "portrait.png", width: 300, height: 400 };

describe("centeredCrop", () => {
  it.each([
    ["a landscape", landscape, { zoom: 1, x: 350, y: 0 }],
    ["a portrait", portrait, { zoom: 1, x: 0, y: 50 }],
  ])("fits the shorter side of %s in the square, centered", (_, source, crop) => {
    expect(centeredCrop(source)).toEqual(crop);
  });
});

describe("panCrop", () => {
  it("moves the image by a share of the square's side", () => {
    expect(panCrop(landscape, centeredCrop(landscape), 0.1, 0)).toEqual({ zoom: 1, x: 260, y: 0 });
  });

  it("keeps the image over the whole square", () => {
    expect(panCrop(landscape, centeredCrop(landscape), 2, 0)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(panCrop(landscape, centeredCrop(landscape), -2, -1)).toEqual({ zoom: 1, x: 700, y: 0 });
    const closer = { zoom: 2, x: 0, y: 0 };
    expect(panCrop(landscape, closer, 0, -3)).toEqual({ zoom: 2, x: 0, y: 450 });
  });
});

describe("zoomCrop", () => {
  it("keeps the center in place by default", () => {
    expect(zoomCrop(landscape, centeredCrop(landscape), 2)).toEqual({ zoom: 2, x: 575, y: 225 });
  });

  it("keeps the source pixel under the focus point in place", () => {
    const crop = zoomCrop(landscape, centeredCrop(landscape), 2, 0.25, 0.75);
    const before = { x: 350 + 0.25 * 900, y: 0.75 * 900 };
    const side = cropSide(landscape, crop.zoom);
    expect({ x: crop.x + 0.25 * side, y: crop.y + 0.75 * side }).toEqual(before);
  });

  it("stays between the fitted zoom and the closest one", () => {
    expect(zoomCrop(landscape, centeredCrop(landscape), 0.5).zoom).toBe(1);
    expect(zoomCrop(landscape, centeredCrop(landscape), 10).zoom).toBe(maxZoom);
  });

  it("pushes the square back over the image when zooming out near an edge", () => {
    expect(zoomCrop(landscape, { zoom: 2, x: 1150, y: 450 }, 1)).toEqual({ zoom: 1, x: 700, y: 0 });
  });
});

describe("pictureSide", () => {
  it.each([
    ["the source pixels a crop keeps", { url: "", width: 400, height: 300 }, 1, 300],
    ["512 pixels at most", landscape, 1, 512],
    ["the closest zoom of a large source", landscape, 1.5, 512],
    ["a rounded side", { url: "", width: 1000, height: 1000 }, 3, 333],
    ["1 pixel at least", { url: "", width: 2, height: 2 }, maxZoom, 1],
  ])("saves %s", (_, source, zoom, side) => {
    expect(pictureSide(source, { zoom, x: 0, y: 0 })).toBe(side);
  });
});

describe("imagePlacement", () => {
  it("scales and offsets the image so the crop fills the square", () => {
    expect(imagePlacement(landscape, { zoom: 2, x: 450, y: 225 })).toEqual({
      width: 355.55555555555554,
      left: -100,
      top: -50,
    });
  });
});
