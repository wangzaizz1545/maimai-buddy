"""Agent Core：六阶段推理管线（Phase 6 落地）。

规划内容：
- pipeline.py   S1-S6 编排
- stages/       perceive / recall / persona / plan / act / compose
- planner.py    工具选择（白名单 + schema 校验）
- guardrails.py 预算、忌口、心理危机拦截、下单二次确认
- trace.py      推理轨迹采集与 SSE 推送
"""
