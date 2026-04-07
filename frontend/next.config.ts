import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // Faster page transitions: shorter buffer between navigations
  experimental: {
    // Optimize barrel imports for these heavy libs (handles tree-shaking automatically)
    optimizePackageImports: ['lucide-react', 'recharts', '@base-ui/react'],
  },

  // Don't run ESLint during builds (already runs separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
