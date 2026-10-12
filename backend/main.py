"""McBuddy AI 后端入口。

职责：
1. 提供健康检查与运行时信息接口
2. 提供推荐数据接口（经 MCP Adapter 取数）
3. 托管 frontend 的静态导出产物，使整个应用只需一个端口、一条命令

路由注册顺序很关键：先注册 API 路由，最后挂载静态目录。
Starlette 按注册顺序匹配，顺序反了 /health 会被静态目录拦截。
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend import config
from backend.api import recommend

app = FastAPI(title=config.APP_NAME, version=config.APP_VERSION)

# 仅用于本地开发：允许 next dev(:3000) 直接访问后端。
# 正式形态下前端由本服务同源托管，不依赖 CORS。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """启动脚本轮询探活使用，同时也是验收测试项。"""
    return {"status": "ok"}


@app.get("/api")
def api_info() -> dict[str, str]:
    """运行模式快照。前端首页的状态徽标读取此接口。"""
    return config.as_dict()


# 推荐数据接口（只读）：/api/recommend/menu · /promotions · /calculate
# 必须在静态目录 mount 之前注册，否则会被静态目录吞掉
app.include_router(recommend.router)


# ---------------------------------------------------------------------------
# 静态前端托管
# ---------------------------------------------------------------------------
if config.FRONTEND_OUT.is_dir():
    # html=True 使 "/" 自动映射到 index.html
    app.mount(
        "/",
        StaticFiles(directory=str(config.FRONTEND_OUT), html=True),
        name="frontend",
    )
else:
    # 未构建前端时的降级提示，避免直接 404 让人摸不着头脑
    @app.get("/")
    def frontend_not_built() -> dict[str, str]:
        return {
            "name": config.APP_NAME,
            "mode": config.MODE,
            "status": "frontend_not_built",
            "hint": "未找到 frontend/out，请先在 frontend/ 目录执行 pnpm build",
        }
