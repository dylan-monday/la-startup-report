/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the /api/chat route up to 60 seconds on Vercel Pro.
  // On Hobby plan the hard cap is 10s — upgrade at vercel.com/dashboard
  // -> project -> Settings -> Functions -> Max Duration.
  serverExternalPackages: [],
};
module.exports = nextConfig;
