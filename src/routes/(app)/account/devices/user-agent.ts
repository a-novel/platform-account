import type { DeviceName } from "#lib/application/auth/types.js";

// Each User-Agent also names the engines it descends from, so a browser comes before its ancestors:
// Edge and Opera before Chrome, Chrome before Safari, and Android before Linux.
const browsers = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
] as const;

const systems = [
  [/\biPhone\b|\biPod\b/, "iOS"],
  [/\biPad\b/, "iPadOS"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows\b/, "Windows"],
  [/\bMacintosh\b|\bMac OS X\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
] as const;

/** Names the browser and system a User-Agent claims. A browser it cannot recognize stays unnamed. */
export function readDeviceName(userAgent: string): DeviceName {
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1];

  // An Android tablet's User-Agent leaves out the "Mobile" token its phones carry.
  let form: DeviceName["form"] = "desktop";
  if (/\biPad\b|\bTablet\b|\bAndroid\b(?!.*\bMobile\b)/.test(userAgent)) form = "tablet";
  else if (/\bMobile\b|\biPhone\b|\biPod\b/.test(userAgent)) form = "phone";

  return { browser, system, form };
}
