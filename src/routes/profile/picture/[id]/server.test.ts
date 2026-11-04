import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import { AuthenticationSession, AuthenticationUnavailableError } from "#lib/server/auth/session.js";
import { getProfileContext } from "#lib/server/profile/context.js";

import { GET } from "./+server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import { ProfileApi, profilePictureGet } from "@a-novel/service-profile-rest";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("#lib/server/profile/context.js", { spy: true });
vi.mock("@a-novel/service-profile-rest", { spy: true });

const anonymousAccessToken = vi.spyOn(AuthenticationSession.prototype, "anonymousAccessToken");
const profileApi = new ProfileApi("https://profile.test");
const id = "019a4e2c-7d1f-7c3a-9b2e-5f1d0c8a4b21";

function get(path: string) {
  const url = new URL(path, "https://account.test");
  const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(cookies));
  vi.mocked(getProfileContext).mockReturnValue({ api: profileApi, self: vi.fn() });
  return GET({ url, params: { id: url.pathname.split("/").at(-1) }, cookies } as never);
}

describe("GET /profile/picture/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    anonymousAccessToken.mockResolvedValue("visitor-access");
  });

  it("serves a versioned picture for good, with its stored type and no sniffing", async () => {
    vi.mocked(profilePictureGet).mockResolvedValue(new Blob(["webp bytes"], { type: "image/webp" }));

    const response = await get(`/profile/picture/${id}?v=2026-11-04T08%3A15%3A30.123456Z`);

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toEqual({
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/webp",
      "x-content-type-options": "nosniff",
    });
    await expect(response.text()).resolves.toBe("webp bytes");
    expect(profilePictureGet).toHaveBeenCalledExactlyOnceWith(profileApi, "visitor-access", { id });
  });

  it("makes a cache check an unversioned picture on every use", async () => {
    vi.mocked(profilePictureGet).mockResolvedValue(new Blob(["jpeg bytes"], { type: "image/jpeg" }));

    const response = await get(`/profile/picture/${id}`);

    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });

  it("answers 404 for an ID that names no profile, without asking any service", async () => {
    const response = await get("/profile/picture/not-a-uuid?v=1");

    expect(response.status).toBe(404);
    expect(anonymousAccessToken).not.toHaveBeenCalled();
    expect(profilePictureGet).not.toHaveBeenCalled();
  });

  it.each([
    ["a profile without a picture", new HttpError(404, ""), 404],
    ["an outage of the profile service", new HttpError(503, "private service detail"), 503],
  ])("passes %s through, uncached", async (_, error, status) => {
    vi.mocked(profilePictureGet).mockRejectedValue(error);

    const response = await get(`/profile/picture/${id}?v=1`);

    expect(response.status).toBe(status);
    expect(response.headers.has("cache-control")).toBe(false);
    await expect(response.text()).resolves.toBe("");
  });

  it("answers 503 while Authentication cannot give the visitor a token", async () => {
    anonymousAccessToken.mockRejectedValue(new AuthenticationUnavailableError());

    expect((await get(`/profile/picture/${id}?v=1`)).status).toBe(503);
    expect(profilePictureGet).not.toHaveBeenCalled();
  });
});
