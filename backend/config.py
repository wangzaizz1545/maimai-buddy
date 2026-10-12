"""McBuddy AI 运行时配置。

所有配置均可通过环境变量覆盖；默认值即 Demo Mode
（零 Token、零 API Key、零外部服务依赖）。
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

from backend.mcp import config as mcp_config

# 项目根目录（本文件位于 backend/ 下）
ROOT_DIR = Path(__file__).resolve().parent.parent

# 加载 .env；文件不存在时静默跳过，保证 Demo Mode 永远可运行
load_dotenv(ROOT_DIR / ".env")

APP_NAME = "McBuddy AI"
APP_VERSION = "0.1.0"


def _env(key: str, default: str) -> str:
    """读取环境变量，空字符串按未设置处理。"""
    value = os.getenv(key, "").strip()
    return value or default


# 运行模式：demo（默认）| live | full
MODE = _env("MCBUDDY_MODE", "demo")
# LLM 提供方：replay（默认，规则引擎回放）| deepseek | openai ...
LLM = _env("MCBUDDY_LLM", "replay")
# MCP 数据源：fixture（默认，本地快照）| live
# 委托给 mcp/config.py，避免同一个变量在两处被读取而产生分歧
MCP = mcp_config.get_mcp_mode()
# SQLite 数据库路径（相对项目根目录）
DATABASE_PATH = ROOT_DIR / _env("DATABASE_PATH", "database/mcbuddy.db")

# 前端静态导出产物目录
FRONTEND_OUT = ROOT_DIR / "frontend" / "out"


def as_dict() -> dict[str, str]:
    """返回当前运行配置快照，供前端状态徽标展示。"""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "mode": MODE,
        "llm": LLM,
        "mcp": MCP,
    }
