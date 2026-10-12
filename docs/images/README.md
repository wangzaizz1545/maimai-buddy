# README 配图

本目录存放 README 引用的截图，均由**无头 Edge 渲染真实页面**后截取。

| 文件 | 尺寸 | 大小 | 内容 | 出现位置 |
|---|---|---|---|---|
| `hero.png` | 860×2606 | 199 KB | 人格结果页：人格卡 + 六维雷达图 + 推荐场景 | README 首屏 |
| `store.png` | 860×1800 | 143 KB | 门店选择页：搜索框 + 实时数据徽标 + 门店卡片 | 「真实调用链」节 |
| `recommend.png` | 860×2498 | 178 KB | 今日推荐页：推荐卡 + 🟡 数据来源徽标 | 「它是怎么工作的」节 |
| `poster.png` | 560×747 | 256 KB | 3:4 竖版分享海报 | 「它是什么」节 |

截图角色：🧑‍💻 **深夜代码战士**（`night_coder`）——契合程序员节主题。

---

## 如何重新生成

截图依赖 `localStorage` 中的画像数据，直接用无头浏览器访问 `/result/`、`/recommend/`
会被重定向到 `/personality/`。因此需要先种入数据。

### 步骤

```bash
# 1. 用项目自己的算法反推一组能命中目标人格的作答，生成种子页
cd frontend
pnpm dlx tsx scripts/_seed.ts          # 见下方「种子脚本」说明

# 2. 启动服务
cd ..
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 3. 用 CDP 截图（脚本在项目外，避免引入运行时依赖）
python _qa/screenshot.py

# 4. 后期处理（裁剪、缩放、压缩）

# 5. 清理
del frontend\out\_seed.html
```

### 两个必须注意的坑

1. **`--force-device-scale-factor` 会让 `--window-size` 下的内容溢出**，
   截出来像是布局缺陷，实际不是。用 CDP 的 `Emulation.setDeviceMetricsOverride`
   才能真正控制 CSS 视口。
2. **`--virtual-time-budget` 不会推进 framer-motion 的动画**，
   `/result/` 会截到一张几乎全黑的图。必须用 CDP 真实等待，并点击「跳过动画」按钮。

---

## 维护约定

- 单张 **< 500 KB**，三张合计 < 1 MB（当前 633 KB）
- 重命名文件需同步修改 README 中的 `<img src>`
- 截图前确认页面**没有**任何个人信息（本项目不采集，但请目视确认）
- 配色为品牌灵感设计，**不要**让麦当劳官方 Logo 出现在截图中
- 若门店营业时段截图，徽标会显示 🟢 实时数据——**如实保留徽标，不要裁剪掉**
