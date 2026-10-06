#!/usr/bin/env python3
"""Render three Stage 7 UI system diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "范围：两版桌面 Web 的最小 UI/ScrollView 探针；真实窗口 resize、惯性和原生另验。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 7 · UI 布局与滚动交互", font=font(72), fill=INK)
    draw.text((118, 178),
              "同一行为：适配 Canvas → 动态列表 → 点击子项 → 拖动或滚轮",
              font=font(34), fill=MUTED)
    left = [
        "Canvas 单例 + Camera\n尺寸 / 锚点在 Node",
        "View 改设计尺寸至 1280×720\n当前 Canvas / 背景仍 960×640",
        "Layout：三项→四项可重排\n清空后保留 300×266",
        "Node 触摸 → Button\n轻点发 clickEvents / click",
        "ScrollView MOVE 捕获中\n同步移动 Content；拖动可 cancel",
        "滚轮超时发 scroll-ended\n但 _scrolling 留在 true",
    ]
    right = [
        "Canvas 是 RenderRoot2D\n尺寸 / 锚点在 UITransform",
        "View 改设计尺寸：Widget 变脏\n下一 AFTER_UPDATE 对齐 Canvas",
        "Layout：三项→四项可重排\n清空后容器高 10",
        "PointerDispatcher → Button\n轻点发 clickEvents / CLICK",
        "ScrollView MOVE 先累加位移\n后续 update(dt) 移动 Content",
        "滚轮超时发 scroll-ended\n并清 _scrolling=false",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两版轻点都触发 Button；累计拖动超过当前源码阈值时都取消子项点击\n上述差异来自当前 Web 探针；ScrollBar、弹性惯性、嵌套与 Native 尚未验证",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage7-2.4-ui-system.png",
        "2.4.15 · Canvas 到列表交互",
        "Node 尺寸 / WidgetManager / Layout / ScrollView · Web 预览",
        [
            ("01  视图适配", ["Canvas\n设计尺寸 / Fit 设置", "CCCanvas.applySettings\n→ CCView 策略", "计算 scale / visibleRect\n与相机视口", "Node 保存尺寸 / 锚点\nWidget 据此对齐"]),
            ("02  对齐与排版", ["WidgetManager\nAFTER_UPDATE 对齐", "Widget 写入\nNode 尺寸 / 位置", "Layout 监听增删 / 尺寸\n排列表项", "Label.string 变更\n标记顶点脏"]),
            ("03  可见与点击", ["Sprite / Label\nRenderFlow + assembler", "Canvas Camera\n选择可见 UI", "Node 命中\nButton 收 TOUCH", "TOUCH_END 后\nclickEvents → node click"]),
            ("04  ScrollView 手势", ["Mask View + Content\n以 Node 尺寸算边界", "ScrollView 捕获触摸\n区分轻点与拖动", "MOVE 捕获中\n同步移动 Content", "超过阈值后\n模拟子项 CANCEL"]),
            ("05  本次观测（并列）", ["三项→四项后\n手动 updateLayout 重排", "清空后容器仍\n300×266 且标脏", "直接改 View 尺寸\nCanvas / 背景未跟随", "滚轮结束已发事件\n_scrolling 仍 true"]),
        ], BLUE, BLUE_LIGHT, FOOTER, independent_sections=(4,),
    )
    make_detail(
        OUT / "stage7-3.8-ui-system.png",
        "3.8.7 · Canvas 到列表交互",
        "UITransform / RenderRoot2D / Layout / ScrollView · Web 预览",
        [
            ("01  视图适配", ["项目 View 策略\n设计尺寸 / Fit", "View 计算 scale\n与 visibleRect", "Canvas 作为 RenderRoot2D\n注册 Batcher2D", "UITransform 存尺寸\nCamera 由层可见性决定"]),
            ("02  对齐与排版", ["View 尺寸变化\nWidget 标脏", "WidgetManager\nAFTER_UPDATE 对齐", "Layout 读取 UITransform\n排列表项", "Label.string 变更\nRenderData 待更新"]),
            ("03  可见与点击", ["UIRenderer / Batcher2D\n汇入渲染管线", "Camera visibility\n选择 UI 层", "UITransform.hitTest\nButton 收 TOUCH", "TOUCH_END 后\nclickEvents → CLICK"]),
            ("04  ScrollView 手势", ["Mask View + Content\n以 UITransform 算边界", "ScrollView 捕获触摸\n区分轻点与拖动", "MOVE 捕获中\n先累加位移", "超阈值模拟 CANCEL\n随后 update(dt) 移动"]),
            ("05  本次观测（并列）", ["三项→四项后\n手动 updateLayout 重排", "清空后容器高 10\n依 padding / spacing", "View 改尺寸标脏\n下一帧 Canvas 对齐", "滚轮结束已发事件\n_scrolling=false"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER, independent_sections=(4,),
    )
    make_comparison(OUT / "stage7-ui-system-comparison.png")
    for name in (
        "stage7-2.4-ui-system.png",
        "stage7-3.8-ui-system.png",
        "stage7-ui-system-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
