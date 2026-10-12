#!/usr/bin/env python3
"""McBuddy AI 一键启动器。

由 start.bat / start.sh 调用，依次完成：

  1. 校验 Python 版本
  2. 首次运行时创建虚拟环境并安装依赖
  3. 用虚拟环境的解释器重新执行自身（确保依赖可用）
  4. 准备 .env、检查前端静态产物
  5. 启动 FastAPI，轮询 /health 就绪后再打开浏览器

为什么把逻辑放在 Python 而不是批处理里：
  cmd.exe 解析含非 ASCII 字符的 .bat 文件并不可靠 —— 在 UTF-8 代码页下
  会错切行，把 URL 截断、把中文标点当成命令。Python 的 UTF-8 处理是确定的，
  且同一份逻辑可以同时服务 Windows 和 macOS/Linux。
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import venv
import webbrowser
from pathlib import Path

# --------------------------------------------------------------------------
# 常量
# --------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
VENV_DIR = ROOT / ".venv"
REQUIREMENTS = ROOT / "backend" / "requirements.txt"
ENV_EXAMPLE = ROOT / ".env.example"
ENV_FILE = ROOT / ".env"
FRONTEND_INDEX = ROOT / "frontend" / "out" / "index.html"

HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"
MIN_PYTHON = (3, 10)
HEALTH_TIMEOUT = 30  # 秒


# --------------------------------------------------------------------------
# 输出helpers
# --------------------------------------------------------------------------
def setup_console() -> None:
    """让 Windows 控制台正确显示中文。任何失败都静默降级，不影响启动。"""
    if os.name != "nt":
        return
    try:
        import ctypes

        # 先把控制台输出代码页切到 UTF-8，再让 Python 以 UTF-8 写出
        if ctypes.windll.kernel32.SetConsoleOutputCP(65001):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def info(message: str) -> None:
    print(f"  {message}", flush=True)


def step(index: int, total: int, message: str) -> None:
    print(f"  [{index}/{total}] {message}", flush=True)


def banner() -> None:
    print()
    print("  ============================================")
    print("    McBuddy AI - 麦麦搭子")
    print("    你的 AI 麦当劳搭子")
    print("  ============================================")
    print(flush=True)


# --------------------------------------------------------------------------
# 环境准备
# --------------------------------------------------------------------------
def venv_python() -> Path:
    """虚拟环境中的解释器路径（跨平台）。"""
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def check_python_version() -> bool:
    if sys.version_info < MIN_PYTHON:
        info(f"[错误] 需要 Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} 或更高版本，"
             f"当前为 {sys.version.split()[0]}")
        info("        下载地址：https://www.python.org/downloads/")
        return False
    return True


def ensure_venv() -> None:
    if venv_python().exists():
        step(2, 5, "虚拟环境已就绪")
        return
    step(2, 5, "首次运行，正在创建虚拟环境 ...")
    venv.EnvBuilder(with_pip=True).create(VENV_DIR)


def install_requirements() -> None:
    step(3, 5, "检查依赖（首次运行约需 30 秒，请稍候）...")
    try:
        subprocess.check_call(
            [
                str(venv_python()),
                "-m",
                "pip",
                "install",
                "--quiet",
                "--disable-pip-version-check",
                "-r",
                str(REQUIREMENTS),
            ]
        )
    except subprocess.CalledProcessError:
        info("[错误] 依赖安装失败，请检查网络连接后重试。")
        raise SystemExit(1)


def ensure_env_file() -> None:
    if ENV_FILE.exists():
        step(4, 5, ".env 已存在")
        return
    ENV_FILE.write_text(ENV_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
    step(4, 5, "已根据 .env.example 生成 .env")


def check_frontend() -> None:
    """前端静态产物缺失时给出明确指引，而不是让人对着空白页面发懵。"""
    if FRONTEND_INDEX.exists():
        return
    print()
    info("[警告] 未找到前端静态产物 frontend/out/index.html，页面可能无法显示。")
    info("        如需重新构建：cd frontend && pnpm install && pnpm build")
    print(flush=True)


# --------------------------------------------------------------------------
# 服务启动
# --------------------------------------------------------------------------
def is_server_up() -> bool:
    """探测 /health 是否可用。"""
    try:
        with urllib.request.urlopen(f"{URL}/health", timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, OSError):
        return False


def wait_for_server(timeout: int = HEALTH_TIMEOUT) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if is_server_up():
            return True
        time.sleep(0.5)
    return False


def open_browser() -> None:
    try:
        webbrowser.open(URL)
    except Exception:
        pass


def run_server() -> int:
    """在虚拟环境中启动 FastAPI，就绪后打开浏览器。"""
    ensure_env_file()
    check_frontend()

    step(5, 5, "正在启动服务 ...")
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:app",
            "--host",
            HOST,
            "--port",
            str(PORT),
        ],
        cwd=str(ROOT),
    )

    try:
        if wait_for_server():
            info("       服务已就绪")
        else:
            info("       [警告] 服务启动超时，仍尝试打开浏览器")

        open_browser()

        print()
        info("--------------------------------------------")
        info(f"  服务地址：{URL}")
        info("  停止服务：按 Ctrl+C（或直接关闭本窗口）")
        info("  运行模式：Demo Mode（零 Token / 零 API Key）")
        info("--------------------------------------------")
        print(flush=True)

        process.wait()
        return process.returncode or 0

    except KeyboardInterrupt:
        print()
        info("正在停止服务 ...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        info("已停止，再见 🍔")
        return 0


# --------------------------------------------------------------------------
# 入口
# --------------------------------------------------------------------------
def main() -> int:
    setup_console()

    if not check_python_version():
        return 1

    # 若当前不是虚拟环境中的解释器：准备环境后用虚拟环境重新执行自身
    try:
        in_venv = Path(sys.executable).resolve() == venv_python().resolve()
    except OSError:
        in_venv = False

    if not in_venv:
        banner()
        step(1, 5, f"Python 检测通过（{sys.version.split()[0]}）")
        ensure_venv()
        install_requirements()

        # 用虚拟环境的解释器重新执行本脚本，保证后续 import 可用
        os.execv(str(venv_python()), [str(venv_python()), str(Path(__file__).resolve())])
        return 0  # 不会执行到

    banner()

    # 端口上已有服务在跑时，直接打开浏览器，避免重复启动造成报错
    if is_server_up():
        info(f"检测到服务已在运行：{URL}")
        open_browser()
        return 0

    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
