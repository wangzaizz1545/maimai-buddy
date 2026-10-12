# frontend —— McBuddy AI 前端

Next.js 14（App Router）+ TypeScript + Tailwind CSS + Framer Motion。

## 重要：产物需要提交

本项目使用 **静态导出**（`output: "export"`），构建产物输出到 `out/`，
由 FastAPI 以静态文件方式托管。

**`out/` 是被刻意保留在版本控制中的**（见 `frontend/.gitignore` 的注释），
这样访客只需要 Python 就能运行整个应用，无需安装 Node.js。

修改前端代码后，务必重新构建并提交产物：

```bash
pnpm install
pnpm build
```

## 本地开发

```bash
pnpm dev        # 开发服务器 :3000
```

若需在开发模式下访问后端 API，设置环境变量：

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

（后端已配置允许 `localhost:3000` 的 CORS。正式形态下前后端同源，无需此配置。）

## 说明文件

- `next.config.mjs` —— 静态导出、`trailingSlash`、图片优化关闭三项配置
- `pnpm-workspace.yaml` —— 放行 `unrs-resolver` 的构建脚本（pnpm 11 默认阻止）
- `globals.css` —— 设计令牌（颜色以 RGB 三元组存储，使透明度修饰符可用）
- `tailwind.config.ts` —— 令牌注册（颜色、圆角、动效）
- `lib/types.ts` —— 全站共享类型
- `lib/scoring.ts` —— 六维向量构建与人格匹配算法
- `lib/store.ts` —— localStorage 持久化（SSR 安全）
- `data/` —— 题目、人格原型、Mock 档案
- `components/` —— 设计系统与业务组件

## 人格匹配算法验证

`scripts/verify-personas.ts` 会**穷举全部 6144 种作答组合**，验证：

1. 8 种人格全部可达（不会有人永远测不出来）
2. 不同作答得到不同人格（结果不是写死的）
3. 置信度与混合型占比落在合理区间

运行：

```bash
pnpm dlx tsx scripts/verify-personas.ts
```

> 该脚本是 Node 侧工具，通过 `tsx` 运行（未加入 package.json 依赖，避免污染运行时依赖树）。

## 关于 tsconfig 的 target

`target` 设为 `ES2020`，是为了让 `scripts/` 下的 Node 工具脚本能通过类型检查
（生成器 `yield*` 在默认的 ES5 下不被允许）。

由于配置了 `noEmit: true`，且 Next.js 实际使用 SWC 打包，
该设置**只影响类型检查语义，不影响构建产物**。

完整项目说明见仓库根目录的 [`README.md`](../README.md)，
架构与开发计划见 [`docs/DEV_PLAN.md`](../docs/DEV_PLAN.md)。
