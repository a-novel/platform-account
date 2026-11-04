import manifest from "./package.json" with { type: "json" };

import { SvelteKitVite } from "@a-novel-kit/nodelib-config/sveltekit";
import { Yaml } from "@a-novel-kit/nodelib-config/yaml";

export default SvelteKitVite(
  {
    optimizeDeps: {
      include: ["@a-novel-kit/uikit", "@lucide/svelte"],
    },
    plugins: [Yaml()],
  },
  {
    // Any page can open the login dialog, so no site may frame one (RFC 9700 §4.16). nodelib's preset
    // sends this directive by default from 2.4.3, which a directive of the same name replaces. The
    // browser reports to its Faro app's collector (a-novel/.github#527).
    csp: {
      directives: {
        "frame-ancestors": ["none"],
        "connect-src": ["self", "https://faro-collector-prod-eu-west-2.grafana.net"],
      },
    },
    // Deployments derive the origin from each request. A build for a known address, such as the
    // Playwright server, trusts ORIGIN instead.
    paths: { origin: process.env.ORIGIN },
    tracing: { server: true },
    // The release version names the build, so browser telemetry reports which release it runs.
    version: { name: manifest.version },
  }
);
