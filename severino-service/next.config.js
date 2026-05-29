/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@severino/db'],
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
}

module.exports = nextConfig
