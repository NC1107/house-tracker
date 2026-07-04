/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image.
  output: "standalone",
  images: {
    // Listing photos come off Redfin's CDN as ~600KB JPEGs; next/image resizes them to
    // card size, converts to webp, and caches the result locally for a day.
    remotePatterns: [{ protocol: "https", hostname: "ssl.cdn-redfin.com" }],
    minimumCacheTTL: 86_400,
  },
};

export default nextConfig;
