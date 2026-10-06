#!/usr/bin/env python3
"""Render three Stage 5 input and event diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "范围：两版 Creator 桌面 Web 预览；Native/小游戏输入桥与 3D 射线需分别验证。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 5 · 输入与事件分发", font=font(72), fill=INK)
    draw.text((118, 178),
              "同一行为：点击重叠节点、沿父链传播、监听全局与自定义事件",
              font=font(34), fill=MUTED)
    left = [
        "Web DOM → CCInputManager\n→ CCEventManager",
        "CCNode._hitTest；触摸认领\n上层默认吞噬下层触摸",
        "节点输入：父捕获 → 目标\n→ 父冒泡；拖出后可 cancel",
        "cc.systemEvent\n公开键盘 / 重力感应入口",
        "Node.emit 仅本节点\nEventCustom 的 useCapture 被忽略",
        "getLocation 设计坐标\ngetLocationInView 原点不同",
    ]
    right = [
        "PAL InputSource → Input\n→ UI / GLOBAL dispatcher",
        "UITransform.hitTest；UI 优先\npreventSwallow 可向下穿透",
        "NodeEventProcessor：父捕获\n→ 目标 → 父冒泡 / cancel",
        "input 是全局公开入口\nsystemEvent 是兼容桥",
        "Node.emit 仅本节点\n自定义 dispatchEvent 可捕获",
        "getLocation 屏幕坐标\ngetUILocation 是 UI 坐标",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "Web 实测：2.4 重叠鼠标按下到达两层；3.8 只到上层 UI\n3.8 UI 已处理时可阻止全局 input；两版原生和小游戏输入仍需验证",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage5-2.4-input-and-events.png",
        "2.4.15 · 从浏览器输入到节点",
        "CCInputManager / CCEventManager / Node · Chrome 预览",
        [
            ("01  平台输入", ["Canvas / Window\n浏览器鼠标与触摸", "CCInputManager\n注册系统事件", "cc.view 转换\n设计坐标与 Touch", "构造 EventTouch\n或 EventMouse"]),
            ("02  命中与路由", ["CCEventManager\ndispatchEvent", "场景图优先级\n选择 Node listener", "CCNode._hitTest\n相机 / 矩阵 / Mask", "触摸认领并吞噬\n下层 sibling"]),
            ("03  节点传播", ["Node.dispatchEvent\n建立祖先链", "父节点 capture\n先收到事件", "命中目标 Node\n调用监听回调", "可冒泡时父节点\nbubble 回调"]),
            ("04  触摸后续", ["touch-start\n原节点认领触点", "拖出区域仍接收\ntouch-move", "区域外结束\n改为 touch-cancel", "Node 停用 / 销毁\n底层 listener 暂停 / 清理"]),
            ("05  其他公开入口（并列）", ["cc.systemEvent\n键盘 / 重力感应", "Node.emit\n只通知当前节点", "EventCustom dispatch\n可冒泡；useCapture\n对普通自定义类型无效", "Node.off / systemEvent.off\n按监听参数注销"]),
        ], BLUE, BLUE_LIGHT, FOOTER, independent_sections=(4,),
    )
    make_detail(
        OUT / "stage5-3.8-input-and-events.png",
        "3.8.7 · 从平台输入到 UI 节点",
        "PAL InputSource / Input / PointerEventDispatcher · Chrome 预览",
        [
            ("01  平台输入", ["PAL Web InputSource\n监听 Canvas / Window", "屏幕适配与\n触点坐标换算", "构造 EventTouch\n或 EventMouse", "Input._emitEvent\n按优先级派发"]),
            ("02  UI 命中与路由", ["UI dispatcher\n优先级 1", "PointerEventDispatcher\n排序 UI 处理器", "UITransform.hitTest\n检查命中", "NodeEventProcessor\n认领 Touch ID"]),
            ("03  节点传播", ["Node.dispatchEvent\n建立祖先链", "父节点 capture\n先收到事件", "命中目标 Node\n调用监听回调", "父 bubble；UI 已处理\n可阻止 GLOBAL"]),
            ("04  触摸后续", ["touch-start 可设置\npreventSwallow=true", "处理器认领触点\n下层可收到开始事件", "拖出区域仍接收\ntouch-move", "区域外结束→cancel\n结束穿透需另设"]),
            ("05  其他公开入口（并列）", ["input 全局入口\nUI 未处理时可接收", "systemEvent\n弃用的兼容桥", "Node.emit 仅本节点\ndispatchEvent 可捕获", "3D 拾取：input 位置\n→ Camera Ray\n→ 物理查询"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER, independent_sections=(4,),
    )
    make_comparison(OUT / "stage5-input-and-events-comparison.png")
    for name in (
        "stage5-2.4-input-and-events.png",
        "stage5-3.8-input-and-events.png",
        "stage5-input-and-events-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
