module.exports = {
  reactStrictMode: true,
  allowedDevOrigins: ["local-origin.dev", "*.local-origin.dev"],

  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:5000/:path*" },
    ];
  },
};
