-- McBuddy AI 数据库结构
--
-- Phase 2 仅建立版本表，用于验证数据库可连通。
-- 完整的 9 张表（profiles / persona_results / memory_items / conversations /
-- messages / agent_traces / recommendations / share_cards / mcp_cache）
-- 将在 Phase 5（Memory 系统）落地，见 docs/DEV_PLAN.md 第 4.2 节。

CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT    NOT NULL
);

INSERT OR IGNORE INTO schema_version (version, applied_at)
VALUES (1, datetime('now'));
