/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：构建产物输出到 frontend/out，
  // 由 FastAPI 以静态文件方式托管，访客因此不需要安装 Node。
  output: "export",

  // 静态导出下没有 Node 服务端，图片优化必须关闭。
  images: { unoptimized: true },

  // 为每个路由生成 xxx/index.html。
  // 这样纯静态服务器（FastAPI StaticFiles）才能正确响应 /chat 这类子路径，
  // 否则只有 "/" 可用、子页面会 404。
  trailingSlash: true,
};

export default nextConfig;
