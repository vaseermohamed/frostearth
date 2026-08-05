/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["razorpay"],
  },

  async rewrites() {
    return [
      {
        source: "/",
        destination: "/c/founder",
      },
    ];
  },
};

export default nextConfig;