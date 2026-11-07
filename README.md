<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://raw.githubusercontent.com/a-novel-kit/ui-assets/master/packages/images/files/banner/960h/agora-banner.png"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://raw.githubusercontent.com/a-novel-kit/ui-assets/master/packages/images/files/banner/960h/agora-banner-light.png"
    />
    <img
      alt="Agora"
      src="https://raw.githubusercontent.com/a-novel-kit/ui-assets/master/packages/images/files/banner/960h/agora-banner-light.png"
      width="1010"
    />
  </picture>
</p>

# Account platform

Where Agora users manage their account and complete the links Agora emails them.

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/agorastoryverse)](https://twitter.com/agorastoryverse)
[![Discord](https://img.shields.io/discord/1315240114691248138?logo=discord)](https://discord.gg/rp4Qr8cA)

<hr />

![GitHub repo file or directory count](https://img.shields.io/github/directory-file-count/a-novel/platform-account)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/a-novel/platform-account)
[![License: RPL-1.5](https://img.shields.io/badge/license-RPL--1.5-blue)](LICENSE)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/a-novel/platform-account/main.yaml)
[![codecov](https://codecov.io/gh/a-novel/platform-account/graph/badge.svg)](https://codecov.io/gh/a-novel/platform-account)

![Coverage graph](https://codecov.io/gh/a-novel/platform-account/graphs/sunburst.svg)

## What it does

The account platform is the browser application where users of every Agora app manage their
account: the public profile's username and picture, the password, the email address and its
pending change, and the privacy settings. It also
serves the pages behind the authentication service's email links, which create an account, reset a
password and confirm a new email. Its header lists the other Agora apps.

It is also where every other Agora app signs people in. An app sends the visitor to `/authorize`
with an OAuth 2.0 authorization request ([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.1),
with PKCE). The platform logs the visitor in if needed, then sends them back to the app with a
one-time code, which the app's server exchanges with the authentication service.

Its SvelteKit server renders the pages and is the only caller of the authentication and profile
services. Session tokens stay in server-set cookies and never reach browser code. The server also
serves each profile picture at `/profile/picture/<id>`.

The platform ships as one container image. The
[published Storybook](https://a-novel.github.io/platform-account/) shows every screen state.

## Deploying

Run a tag from the [latest release](https://github.com/a-novel/platform-account/releases/latest) and
point it at the authentication and profile services and at Studio. The image runs as a non-root user on port
`3000`, and its container healthcheck calls `/ping`.

```bash
PLATFORM_ACCOUNT_VERSION="vX.Y.Z"
AUTHENTICATION_SERVICE_URL="https://authentication.example.com"
JSON_KEYS_SERVICE_URL="https://json-keys.example.com"
PROFILE_SERVICE_URL="https://profile.example.com"
STUDIO_URL="https://studio.example.com"
podman run --detach --name platform-account --publish 3000:3000 \
  --env AUTHENTICATION_SERVICE_URL="$AUTHENTICATION_SERVICE_URL" \
  --env JSON_KEYS_SERVICE_URL="$JSON_KEYS_SERVICE_URL" \
  --env PROFILE_SERVICE_URL="$PROFILE_SERVICE_URL" \
  --env STUDIO_URL="$STUDIO_URL" \
  ghcr.io/a-novel/platform-account:"$PLATFORM_ACCOUNT_VERSION"
```

The authentication service builds its email links from its `PLATFORM_AUTH_URL`, which names this
platform's public URL.

### Configuration

| Name                             | Required       | Description                                                                                                                                       |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTHENTICATION_SERVICE_URL`     | Yes            | Base HTTP or HTTPS URL for the authentication service.                                                                                            |
| `JSON_KEYS_SERVICE_URL`          | Yes            | Base HTTP or HTTPS URL for the JSON keys service's REST API, whose public keys verify access tokens.                                              |
| `PROFILE_SERVICE_URL`            | Yes            | Base HTTP or HTTPS URL for the profile service, which stores each user's public profile.                                                          |
| `STUDIO_URL`                     | Yes            | Public URL of Studio, which the app list opens.                                                                                                   |
| `SERVICE_TOKEN_PATH`             | Kubernetes     | File of the projected service token that proves the platform's identity to Authentication. The platform reads it on every call.                   |
| `PROFILE_SERVICE_TOKEN_PATH`     | Kubernetes     | File of the projected service token that proves the platform's identity to the profile service.                                                   |
| `ADDRESS_HEADER`, `XFF_DEPTH`    | Behind a proxy | Where the visitor's IP is read, for rate limiting. The cluster's load balancer appends it, then its own: `X-Forwarded-For` and `2`.               |
| `HEALTHCHECK_TIMEOUT_MS`         | No             | Downstream timeout from 100 to 10,000 ms. The default is 2,000.                                                                                   |
| `DOWNTIME_URL`                   | No             | Planned downtime document. The default is the one infra publishes.                                                                                |
| `PUBLIC_PLATFORM_DOMAIN`         | No             | Domain every Agora platform runs under, where the browser keeps the choices the visitor shares across them. Without it, they stay with this host. |
| `PUBLIC_FARO_URL`                | No             | Collector URL of the platform's Faro app. Without it, the browser reports nothing and asks no consent.                                            |
| `OTEL`                           | No             | `true` records traces, continuing an incoming `traceparent`.                                                                                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT`    | No             | Exports traces over OTLP/HTTP to this base URL instead of stdout.                                                                                 |
| `OTEL_EXPORTER_OTLP_HEADERS`     | No             | Headers each export sends, such as the backend's key. Inject it as a secret.                                                                      |
| `OTEL_EXPORTER_OTLP_COMPRESSION` | No             | `gzip` compresses each export.                                                                                                                    |
| `HOST`                           | No             | Listen address. The image sets `0.0.0.0`.                                                                                                         |
| `PORT`                           | No             | Listen port. The image sets `3000`.                                                                                                               |

## Operational endpoints

| Path           | Success | Purpose                                                                                            |
| -------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `/ping`        | `200`   | Liveness: the process serves traffic. No downstream call.                                          |
| `/healthcheck` | `200`   | Readiness: reports each downstream service with its own dependency map. Any failure returns `503`. |

## Running locally

Installing the platform's packages needs your
[GitHub Packages token](https://a-novel-kit.github.io/stack/dependencies/node#configure). Start the
authentication and profile services, then the platform:

```bash
a-novel run start service-authentication/rest
a-novel run start service-profile/rest
eval "$(a-novel run env service-authentication)"
eval "$(a-novel run env service-profile)"
pnpm install
pnpm dev
```

The committed `.env.local` reads the services' ports from that environment, and points the app list at
Studio's development server. `pnpm storybook` serves the screen catalog at `http://localhost:6006`.

## Contributing

Start with the [developer guide](https://a-novel-kit.github.io/stack/),
then read the [contribution guide](./CONTRIBUTING.md).
