#!/usr/bin/env bash
# ============================================================
#  McBuddy AI - 一键启动脚本 (macOS / Linux)
#  实际逻辑在 scripts/launch.py，与 Windows 版本共用同一份代码。
# ============================================================

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
        exec "$candidate" scripts/launch.py
    fi
done

echo
echo "  [错误] 未检测到 Python。"
echo
echo "  请先安装 Python 3.10 或更高版本：https://www.python.org/downloads/"
echo
exit 1
