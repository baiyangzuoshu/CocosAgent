#!/usr/bin/env python3
"""Render three Stage 2 object and scene lifecycle diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, LINE, MUTED, PURPLE, PURPLE_LIGHT, WHITE,
    arrow, draw_column, font, text_center,
)


OUT = Path(__file__).resolve().parent


def make_detail(path, title, subtitle, sections, accent, light, footer=None,
                independent_sections=(), detached_sections=()):
    image = Image.new("RGB", (2400, 2650), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((85, 65, 2315, 290), radius=38, fill=accent)
    draw.text((135, 98), title, font=font(72), fill=WHITE)
    draw.text((140, 210), subtitle, font=font(31), fill="#E9F2F7")
    top, height, gap = 350, 365, 67
    firsts, lasts = [], []
    for section_index, (section_title, steps) in enumerate(sections):
        y0 = top + section_index * (height + gap)
        draw.rounded_rectangle((90, y0, 2310, y0 + height), radius=34,
                               fill=WHITE, outline=LINE, width=3)
        label_left = 1750 if section_index in (2, 4) else 124
        draw.rounded_rectangle((label_left, y0 + 27, label_left + 526, y0 + 90),
                               radius=24, fill=light)
        draw.text((label_left + 29, y0 + 40), section_title,
                  font=font(34), fill=accent)
        count, gutter, left, right = len(steps), 52, 130, 2270
        cell_width = (right - left - gutter * (count - 1)) / count
        direction = 1 if section_index % 2 == 0 else -1
        boxes = []
        for index, step in enumerate(steps):
            position = index if direction == 1 else count - 1 - index
            x0 = left + position * (cell_width + gutter)
            box = (x0, y0 + 129, x0 + cell_width, y0 + 320)
            boxes.append(box)
            draw.rounded_rectangle(box, radius=25, fill=light,
                                   outline=accent, width=3)
            text_center(draw, box, step, 31 if count == 4 else 34, spacing=10)
        if section_index not in independent_sections:
            for first, second in zip(boxes, boxes[1:]):
                middle = (first[1] + first[3]) / 2
                if direction == 1:
                    arrow(draw, (first[2] + 7, middle), (second[0] - 7, middle),
                          accent, 6, 16)
                else:
                    arrow(draw, (first[0] - 7, middle), (second[2] + 7, middle),
                          accent, 6, 16)
        firsts.append(boxes[0])
        lasts.append(boxes[-1])
    for section_index, (first, second) in enumerate(zip(lasts, firsts[1:])):
        if (section_index in independent_sections
                or section_index + 1 in independent_sections
                or section_index in detached_sections
                or section_index + 1 in detached_sections):
            continue
        x = (first[0] + first[2]) / 2
        arrow(draw, (x, first[3] + 9), (x, second[1] - 10), accent, 6, 17)
    draw.line((130, 2510, 2270, 2510), fill=LINE, width=3)
    draw.text((140, 2540),
              footer or "范围：两版 Creator 浏览器预览的运行时对象生命周期；编辑器预制体操作另行验证。",
              font=font(27), fill=MUTED)
    image.save(path, optimize=True)


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 2 · 节点、组件与场景对象", font=font(72), fill=INK)
    draw.text((118, 178),
              "同一行为：实例化预制体 → 挂组件 → 入场 → 切换活动状态 → 销毁",
              font=font(34), fill=MUTED)
    left = [
        "cc.Object → _BaseNode\n→ Node → Scene",
        "helloworld.fire 节点/组件\n预制体另用 PrefabInfo.sync",
        "cc.instantiate(cc.Prefab)\n克隆 data 节点树",
        "addComponent → parent=scene\nNodeActivator 激活",
        "active=false / true\nonDisable / onEnable",
        "destroy → 当下失活\n帧内延迟清理与 onDestroy",
    ]
    right = [
        "CCObject → Node → Scene\n另有关联 RenderScene",
        "main.scene\nPrefabInstance / 覆盖记录",
        "instantiate(Prefab)\n克隆 data 节点树",
        "addComponent → setParent\n更新 _scene；激活组件",
        "active=false / true\nonDisable / onEnable",
        "destroy → 当下失活\n帧内延迟清理与 onDestroy",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "共同：脱离场景时 active=true 仍未进入活动层级；入场首次 onLoad → onEnable\n范围：生命周期顺序已在两版 Web 预览观测；编辑器覆盖与跨场景常驻仅有手册/源码证据",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage2-2.4-objects-and-scenes.png",
        "2.4.15 · 场景对象生命周期",
        "节点 / 组件 / 预制体 · 当前 Hello World 场景的浏览器预览",
        [
            ("01  对象模型", ["cc.Object\n对象基类", "_BaseNode\n父子 / 组件 / active", "cc.Node\n变换 / 事件 / 渲染", "cc.Scene\n_load → _activate"]),
            ("02  克隆与挂组件", ["cc.Prefab.data\n节点树模板", "cc.instantiate\n克隆独立节点树", "active=true\nactiveInHierarchy=false", "addComponent\n场景外尚无回调"]),
            ("03  接入活动场景", ["node.parent = scene", "_onHierarchyChanged\n计算活动父链", "NodeActivator\n递归激活节点", "首次 __preload\n→ onLoad → onEnable"]),
            ("04  活动状态切换", ["active=false", "activeInHierarchy=false\n→ onDisable", "active=true", "activeInHierarchy=true\n→ onEnable"]),
            ("05  销毁与清理", ["destroy() 标记待销毁\n并立即 onDisable", "返回时普通 isValid=true\n严格检查=false", "帧内延迟销毁\n子树 / 组件 → onDestroy", "移出父列表\n普通 isValid=false"]),
        ], BLUE, BLUE_LIGHT,
    )
    make_detail(
        OUT / "stage2-3.8-objects-and-scenes.png",
        "3.8.7 · 场景对象生命周期",
        "节点 / 组件 / 预制件 · 当前 main 场景的浏览器预览",
        [
            ("01  对象模型", ["CCObject\n对象基类", "Node\n层级 / 组件 / 3D 变换", "Scene\nRenderScene / Globals", "Scene._load\n展开预制件与覆盖"]),
            ("02  克隆与挂组件", ["Prefab.data\n节点树模板", "instantiate\n克隆独立节点树", "active=true\nactiveInHierarchy=false", "addComponent\n场景外尚无回调"]),
            ("03  接入活动场景", ["node.setParent(scene)\n或设置 parent", "维护 children / _scene\n和事件处理器", "NodeActivator\n递归激活节点", "首次 __preload\n→ onLoad → onEnable"]),
            ("04  活动状态切换", ["active=false", "activeInHierarchy=false\n→ onDisable", "active=true", "activeInHierarchy=true\n→ onEnable"]),
            ("05  销毁与清理", ["destroy() 标记待销毁\n并立即 onDisable", "返回时普通 isValid=true\n严格检查=false", "帧内延迟销毁\n子树 / 组件 → onDestroy", "移出父列表\n普通 isValid=false"]),
        ], PURPLE, PURPLE_LIGHT,
    )
    make_comparison(OUT / "stage2-objects-and-scenes-comparison.png")
    for name in (
        "stage2-2.4-objects-and-scenes.png",
        "stage2-3.8-objects-and-scenes.png",
        "stage2-objects-and-scenes-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
