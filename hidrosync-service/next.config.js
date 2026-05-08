/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hidrosync/db'],
  // Enable `output: 'standalone'` in Docker/CI when the environment supports symlinks
  // (Windows + OneDrive often blocks symlink creation during trace).
}

module.exports = nextConfig
