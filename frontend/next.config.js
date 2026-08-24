module.exports = {
  reactStrictMode: true,
  allowedDevOrigins: ["local-origin.dev", "*.local-origin.dev"],
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",

  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:5000/:path*" },
    ];
  },
};
