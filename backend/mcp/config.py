"""MCP 配置读取 —— 全项目**唯一**读取 MCP 相关环境变量的地方。

读取三个变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MCD_MCP_TOKEN` | 无 | 麦当劳 MCP Token。**只在此处读取，绝不记录、绝不外传、绝不返回给前端** |
| `MCBUDDY_MCP` | `fixture` | 数据源：`fixture`（演示数据）/ `live`（真实 MCP） |
| `MCP_BASE_URL` | `https://mcp.mcd.cn` | MCP 服务地址，通常无需修改 |

配置文件是**项目根目录的 `.env`**（由 `start.bat` / `start.sh` 自动生成）。
`backend/.env.example` 只是同一份配置的说明副本，不是第二个配置源。
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# 与 backend/config.py 指向同一个文件；重复调用是幂等的
load_dotenv(ROOT_DIR / ".env")

DEFAULT_BASE_URL = "https://mcp.mcd.cn"

VALID_MODES = {"fixture", "live"}

# 示例文件里的占位值。若被原样复制进 .env，按「未配置」处理，
# 避免用假 Token 去请求真实服务、拿到一个令人困惑的 401。
_PLACEHOLDERS = {
    "your_token_here",
    "your_mcp_token",
    "changeme",
    "replace_me",
    "xxx",
}


def get_mcp_token() -> str:
    """返回 MCP Token；未配置或仍是占位值时返回空字符串。

    ⚠️ 调用方**不得**把返回值写入日志、响应体或任何持久化存储。
    """
    token = os.getenv("MCD_MCP_TOKEN", "").strip()
    if not token or token.lower() in _PLACEHOLDERS:
        return ""
    return token


def has_mcp_token() -> bool:
    """只回答「有没有配置」，不暴露内容。适合放进日志与诊断信息。"""
    return bool(get_mcp_token())


def get_mcp_mode() -> str:
    """数据源模式。非法值一律回落到安全的 `fixture`。"""
    mode = os.getenv("MCBUDDY_MCP", "").strip().lower()
    return mode if mode in VALID_MODES else "fixture"


def get_mcp_base_url() -> str:
    """MCP 服务地址。"""
    return os.getenv("MCP_BASE_URL", "").strip() or DEFAULT_BASE_URL


def describe() -> dict[str, object]:
    """可安全打印的诊断信息（**不含 Token 内容**）。"""
    return {
        "mode": get_mcp_mode(),
        "base_url": get_mcp_base_url(),
        "token_configured": has_mcp_token(),
    }
