"""MCP 层的异常体系。

单独成模块的原因：`normalize.py`（解析响应）与 `live_provider.py`（发起调用）
都需要抛异常，若定义在任一方都会造成循环导入。

⚠️ 所有异常消息都**不得包含 Token**。
"""

from __future__ import annotations


class McpError(RuntimeError):
    """MCP 调用失败的基类。Adapter 捕获它并降级到 Mock。"""


class McpAuthError(McpError):
    """401 —— Token 无效、过期或未提供。"""


class McpRateLimitError(McpError):
    """429 —— 超过 600 次/分钟。"""


class McpProtocolError(McpError):
    """响应结构不符合预期。"""


class McpBusinessError(McpProtocolError):
    """工具返回 `success=false` 的业务错误。

    区别于协议错误：请求本身是通的，是业务层面拒绝，
    例如「门店可能已关闭或不在营业时间」（code 600057）。

    保留 code 与 message 便于排查，但**不包含任何凭证**。
    """

    def __init__(self, code: int | str | None, message: str, tool: str | None = None):
        self.code = code
        self.tool = tool
        prefix = f"[{tool}] " if tool else ""
        super().__init__(f"{prefix}{message}（code={code}）")
