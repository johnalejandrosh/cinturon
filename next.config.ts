import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle in `.next/standalone` (server.js + only the
  // traced dependencies) for a small, dependency-free Docker runtime image.
  output: "standalone",

  // Next.js 16 Cache Components: data is dynamic by default and we opt-in to
  // caching with `use cache`. This also enables Partial Prerendering (PPR), so
  // the static shell (header + Suspense fallbacks) is served instantly while the
  // data-dependent sections stream in at request time. See AGENTS.md.
  cacheComponents: true,

  // `pg` relies on Node built-ins and optional native bindings; keep it external
  // to the server bundle instead of letting the bundler trace into it.
  serverExternalPackages: ["pg"],

  // The 3D map and large numeric payloads benefit from disabling the image
  // optimizer we don't use, and we keep React strict checks on.
  reactStrictMode: true,
};

export default nextConfig;
