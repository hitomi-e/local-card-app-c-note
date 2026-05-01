import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // iPhoneなど同一LAN上のデバイスからアクセスする際に HMR（Hot Reload）を許可する
  allowedDevOrigins: ['192.168.0.10', '192.168.0.11'],

  // Server Actions のリクエストボディ上限を引き上げる（顔写真アップロード対応）
  // デフォルトは 1MB → storage.ts で 10MB まで許可しているため 10mb に合わせる
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
