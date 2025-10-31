import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['mathlive'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    } else {
      // Server-side configuration for PDF and DOCX parsing
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        encoding: false,
      };
      
      // Externalize packages that might have issues
      config.externals = [
        ...(config.externals || []),
        'canvas',
      ];
      
      // Exclude canvas from client bundle (server-only)
    }
    
    return config;
  },
};

export default nextConfig;
