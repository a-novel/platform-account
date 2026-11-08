import type { PictureSource } from "@a-novel-kit/uikit";

function svg(width: number, height: number, body: string): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

/** A square portrait, as the profile service would store one. */
export const portraitPicture = svg(
  256,
  256,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6f73"/><stop offset="1" stop-color="#26315f"/></linearGradient></defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <circle cx="128" cy="104" r="46" fill="#f2c9a0"/>
  <path d="M40 256c8-58 44-86 88-86s80 28 88 86z" fill="#e0794f"/>
  <path d="M82 96c0-34 22-52 46-52s46 18 46 52c-10-16-26-22-46-22s-36 6-46 22z" fill="#3a2a22"/>`
);

/** A wide landscape the picture dialog frames, with its subject off center. */
export const landscapeSource: PictureSource = {
  url: svg(
    1600,
    900,
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b26b"/><stop offset="1" stop-color="#7a4c8f"/></linearGradient></defs>
    <rect width="1600" height="900" fill="url(#s)"/>
    <circle cx="1040" cy="380" r="150" fill="#fde7a6"/>
    <path d="M0 640l260-200 220 150 300-280 340 300 240-160 240 190v260H0z" fill="#3d3a6b"/>
    <path d="M0 760l320-120 360 90 420-150 500 180v140H0z" fill="#26284a"/>`
  ),
  width: 1600,
  height: 900,
};
