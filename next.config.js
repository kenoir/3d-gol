/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '/3d-gol' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/3d-gol/' : '',
}

module.exports = nextConfig 