import type { ShortCodeJourney } from "#lib/application/auth/types.js";

import { EmailSchema, ShortCodeSchema } from "@a-novel/service-authentication-rest";

import { z } from "zod";

/** ParsedShortCodeLink is an email link's parameters, ready for the service or rejected as missing or invalid. */
export type ParsedShortCodeLink =
  | { status: "missing" }
  | { status: "invalid" }
  | {
      status: "ready";
      journey: "register";
      email: string;
      shortCode: string;
    }
  | {
      status: "ready";
      journey: "email-update";
      email: string;
      shortCode: string;
      userId: string;
    }
  | {
      status: "ready";
      journey: "password-reset";
      shortCode: string;
      userId: string;
    };

const userIdSchema = z.uuid();

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Reads a journey's link parameters, decoding the base64url email address they carry. */
export function parseShortCodeLink(journey: ShortCodeJourney, url: URL): ParsedShortCodeLink {
  const code = readParameter(url.searchParams, "shortCode");
  const target = readParameter(url.searchParams, "target");

  if (code.status === "missing" || target.status === "missing") return { status: "missing" };
  if (code.status === "invalid" || target.status === "invalid") return { status: "invalid" };
  if (!ShortCodeSchema.safeParse(code.value).success) return { status: "invalid" };

  if (journey === "register") {
    const email = decodeEmail(target.value);
    return email
      ? {
          status: "ready",
          journey,
          email,
          shortCode: code.value,
        }
      : { status: "invalid" };
  }

  if (!userIdSchema.safeParse(target.value).success) return { status: "invalid" };

  if (journey === "password-reset") {
    return {
      status: "ready",
      journey,
      shortCode: code.value,
      userId: target.value,
    };
  }

  const source = readParameter(url.searchParams, "source");
  if (source.status === "missing") return { status: "missing" };
  if (source.status === "invalid") return { status: "invalid" };

  const email = decodeEmail(source.value);
  return email
    ? {
        status: "ready",
        journey,
        email,
        shortCode: code.value,
        userId: target.value,
      }
    : { status: "invalid" };
}

function readParameter(
  parameters: URLSearchParams,
  name: string
): { status: "missing" } | { status: "invalid" } | { status: "ready"; value: string } {
  const values = parameters.getAll(name);
  if (values.length === 0 || values[0] === "") return { status: "missing" };
  if (values.length !== 1 || !values[0]) return { status: "invalid" };
  return { status: "ready", value: values[0] };
}

function decodeEmail(value: string): string | null {
  if (value.length > 2048 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null;

  try {
    const email = Buffer.from(value, "base64url").toString("utf8");
    return EmailSchema.safeParse(email).success ? normalizeEmail(email) : null;
  } catch {
    return null;
  }
}
