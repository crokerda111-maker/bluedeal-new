/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  poweredByHeader: false,
  images: {
    maximumRedirects: 0,
    remotePatterns: [
      { protocol: "https", hostname: "gdimg.gmarket.co.kr", port: "", pathname: "/*/still/*" },
      { protocol: "https", hostname: "thumbnail.coupangcdn.com", port: "", pathname: "/thumbnails/remote/*/image/vendor_inventory/**", search: "" },
      { protocol: "https", hostname: "thumbnail.coupangcdn.com", port: "", pathname: "/thumbnails/remote/*/image/retail/images/**", search: "" },
    ],
  },
  headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

module.exports = nextConfig;
