#!/usr/bin/env python3
"""Render three Stage 3 component timing diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "范围：两版 Creator Chrome 预览的组件与计时器；动画、物理和原生帧序另行验证。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 3 · 组件脚本与逐帧调度", font=font(72), fill=INK)
    draw.text((118, 178),
              "同一行为：首次激活 → 帧回调 / 计时器 → 动态新增组件",
              font=font(34), fill=MUTED)
    left = [
        "cc.Class + cc.Component\neditor.executionOrder",
        "NodeActivator：__preload\n→ onLoad → onEnable",
        "Director.mainLoop\nstart → update",
        "直接调用 CCScheduler.update\n计时器 → lateUpdate",
        "update 中 addComponent\nonLoad/onEnable 同步发生",
        "_deferredComps：本帧 start\n下一帧 update / timer0",
    ]
    right = [
        "class extends Component\n@ccclass / @executionOrder",
        "NodeActivator：__preload\n→ onLoad → onEnable",
        "Director.tick\nstart → update",
        "System.update：Scheduler(200)\n计时器 → lateUpdate",
        "update 中 addComponent\nonLoad/onEnable 同步发生",
        "_deferredComps：本帧 start\n下一帧 update / timer0",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两版预览均观测到：优先级 -10 → 0 → 10；零延迟计时器在下一帧 update 后触发\n优先级只约束同轮主要回调；不控制 onDisable / onDestroy 或不同轮激活",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage3-2.4-scripts-and-scheduling.png",
        "2.4.15 · 组件脚本与帧调度",
        "NodeActivator / ComponentScheduler / CCScheduler · Chrome 预览",
        [
            ("01  声明与挂载", ["cc.Class\nextends: cc.Component", "editor.executionOrder\n写入类优先级", "node.addComponent\n节点持有实例", "NodeActivator\n处理首次激活"]),
            ("02  激活批次", ["递归收集组件", "__preload\n→ onLoad", "enabled 且节点活动\n→ onEnable", "ComponentScheduler\n登记 start / 每帧回调"]),
            ("03  普通逐帧路径", ["BEFORE_UPDATE\n→ start → update", "CCScheduler.update\n更新组件计时器", "lateUpdate\n→ AFTER_UPDATE", "延迟销毁\n→ 渲染 / AFTER_DRAW"]),
            ("04  update 中新增组件", ["Spawner.update\n调用 addComponent", "Target.onLoad / onEnable\n同步执行", "_deferredComps\n推迟每帧登记", "本帧 lateUpdate 后\nTarget.start"]),
            ("05  下一帧与停用", ["Target.update\n首次执行", "零延迟 timer0\n在 update 后触发", "Target.lateUpdate", "停用暂停计时器\n销毁取消计时器"]),
        ], BLUE, BLUE_LIGHT, FOOTER,
    )
    make_detail(
        OUT / "stage3-3.8-scripts-and-scheduling.png",
        "3.8.7 · 组件脚本与帧调度",
        "NodeActivator / ComponentScheduler / System Scheduler · Chrome 预览",
        [
            ("01  声明与挂载", ["class extends Component\n@ccclass 注册", "@executionOrder\n写入类优先级", "node.addComponent\n节点持有实例", "NodeActivator\n处理首次激活"]),
            ("02  激活批次", ["递归收集组件", "__preload\n→ onLoad", "enabled 且节点活动\n→ onEnable", "ComponentScheduler\n登记 start / 每帧回调"]),
            ("03  普通逐帧路径", ["BEGIN_FRAME / 输入\n→ start → update", "System.update\n含 Scheduler(200)", "lateUpdate\n→ AFTER_UPDATE", "延迟销毁 / 渲染\n→ AFTER_DRAW / END_FRAME"]),
            ("04  update 中新增组件", ["Spawner.update\n调用 addComponent", "Target.onLoad / onEnable\n同步执行", "_deferredComps\n推迟每帧登记", "本帧 lateUpdate 后\nTarget.start"]),
            ("05  下一帧与停用", ["Target.update\n首次执行", "零延迟 timer0\n在 update 后触发", "Target.lateUpdate", "停用暂停计时器\n销毁取消计时器"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER,
    )
    make_comparison(OUT / "stage3-scripts-and-scheduling-comparison.png")
    for name in (
        "stage3-2.4-scripts-and-scheduling.png",
        "stage3-3.8-scripts-and-scheduling.png",
        "stage3-scripts-and-scheduling-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
