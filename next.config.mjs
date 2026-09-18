const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (publicKey) {
  let safeKey = publicKey.startsWith("sb_publishable_");
  if (publicKey.startsWith("eyJ")) {
    try {
      safeKey =
        JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {
      safeKey = false;
    }
  }
  if (!safeKey)
    throw new Error(
      "Use a Supabase publishable or legacy anon key. A secret/service-role key must never be included in a browser build.",
    );
}
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
