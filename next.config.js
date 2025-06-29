/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '/game-of-life' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/game-of-life/' : '',
}

module.exports = nextConfig 