import { defineConfig } from 'astro/config';

// 如果网站不是部署在域名根目录（例如 https://example.com/photos/），
// 构建时设置：BASE=/photos npm run build
export default defineConfig({
  output: 'static',
  base: process.env.BASE || '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
