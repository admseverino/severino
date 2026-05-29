/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@severino/db'],
  // Enable `output: 'standalone'` in Docker/CI when the environment supports symlinks
  // (Windows + OneDrive often blocks symlink creation during trace).
}

module.exports = nextConfig
