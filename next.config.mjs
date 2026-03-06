/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Hide Next.js dev indicator / route info overlay (the floating "N" menu).
  devIndicators: false,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
