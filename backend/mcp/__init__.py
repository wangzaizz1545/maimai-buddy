"""McBuddy AI 的 MCP Adapter 层。

对外只暴露三个语义化取数函数与一个算价函数，
上层（FastAPI）与前端都只依赖这一层，不感知底层是 Mock 还是真实 MCP。

⚠️ 本包与 MCP 官方 Python SDK 同名，但位于 `backend.` 命名空间下，
因此 `import backend.mcp` 不存在冲突。
（项目根目录另有一个 `mcp/` 占位包，那是 Phase 2 遗留，与本包无关。）
"""
