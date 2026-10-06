#!/usr/bin/env python3
"""Render the three Stage 1 startup flowcharts as self-contained PNG files."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
FONT_PATH = "/System/Library/Fonts/Hiragino Sans GB.ttc"
WHITE = "#FFFFFF"
INK = "#183049"
MUTED = "#52687A"
BLUE = "#1D6C8A"
BLUE_LIGHT = "#EBF6FA"
PURPLE = "#6653A0"
PURPLE_LIGHT = "#F3F0FA"
LINE = "#DCE5EB"


def font(size):
    return ImageFont.truetype(FONT_PATH, size)


def text_center(draw, box, value, size, color=INK, spacing=9):
    x0, y0, x1, y1 = box
    lines = value.split("\n")
    for candidate in range(size, 18, -1):
        f = font(candidate)
        heights = [draw.textbbox((0, 0), line, font=f)[3] for line in lines]
        if (max(draw.textlength(line, font=f) for line in lines) <= x1 - x0 - 34
                and sum(heights) + spacing * (len(lines) - 1) <= y1 - y0 - 30):
            break
    total = sum(heights) + spacing * (len(lines) - 1)
    y = (y0 + y1 - total) / 2
    for line, h in zip(lines, heights):
        width = draw.textlength(line, font=f)
        draw.text(((x0 + x1 - width) / 2, y), line, font=f, fill=color)
        y += h + spacing


def arrow(draw, start, end, color, width=7, head=19):
    draw.line([start, end], fill=color, width=width, joint="curve")
    x0, y0 = start
    x1, y1 = end
    if abs(x1 - x0) >= abs(y1 - y0):
        sign = 1 if x1 > x0 else -1
        wing = [(x1 - sign * head, y1 - head * 0.6), (x1, y1),
                (x1 - sign * head, y1 + head * 0.6)]
    else:
        sign = 1 if y1 > y0 else -1
        wing = [(x1 - head * 0.6, y1 - sign * head), (x1, y1),
                (x1 + head * 0.6, y1 - sign * head)]
    draw.polygon(wing, fill=color)


def make_detail(path, title, subtitle, sections, accent, light):
    image = Image.new("RGB", (2400, 2650), "#F7F9FB")
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((85, 65, 2315, 290), radius=38, fill=accent)
    d.text((135, 98), title, font=font(72), fill=WHITE)
    d.text((140, 210), subtitle, font=font(31), fill="#E9F2F7")
    top = 350
    height = 365
    gap = 67
    firsts = []
    lasts = []
    for section_index, (section_title, steps) in enumerate(sections):
        y0 = top + section_index * (height + gap)
        y1 = y0 + height
        d.rounded_rectangle((90, y0, 2310, y1), radius=34, fill=WHITE, outline=LINE, width=3)
        d.rounded_rectangle((124, y0 + 27, 640, y0 + 90), radius=24, fill=light)
        d.text((153, y0 + 40), section_title, font=font(34), fill=accent)
        count = len(steps)
        gutter = 52
        left = 130
        right = 2270
        cell_w = (right - left - gutter * (count - 1)) / count
        direction = 1 if section_index % 2 == 0 else -1
        boxes = []
        for index, step in enumerate(steps):
            pos = index if direction == 1 else count - 1 - index
            x0 = left + pos * (cell_w + gutter)
            box = (x0, y0 + 129, x0 + cell_w, y0 + 320)
            boxes.append(box)
            d.rounded_rectangle(box, radius=25, fill=light, outline=accent, width=3)
            text_center(d, box, step, 31 if count == 4 else 34, spacing=10)
        for a, b in zip(boxes, boxes[1:]):
            mid_y = (a[1] + a[3]) / 2
            if direction == 1:
                arrow(d, (a[2] + 7, mid_y), (b[0] - 7, mid_y), accent, 6, 16)
            else:
                arrow(d, (a[0] - 7, mid_y), (b[2] + 7, mid_y), accent, 6, 16)
        firsts.append(boxes[0])
        lasts.append(boxes[-1])
    for a, b in zip(lasts, firsts[1:]):
        x = (a[0] + a[2]) / 2
        arrow(d, (x, a[3] + 9), (x, b[1] - 10), accent, 6, 17)
    d.line((130, 2510, 2270, 2510), fill=LINE, width=3)
    d.text((140, 2540), "范围：当前示例的 Creator 浏览器预览；事件顺序依据对应源码与运行轨迹。", font=font(27), fill=MUTED)
    image.save(path, optimize=True)


def draw_column(d, x0, x1, top, title, steps, accent, light,
                show_arrows=True):
    bottom = 1730
    d.rounded_rectangle((x0, top, x1, bottom), radius=35, fill=WHITE, outline=accent, width=4)
    d.rounded_rectangle((x0 + 25, top + 25, x1 - 25, top + 124), radius=27, fill=accent)
    text_center(d, (x0 + 35, top + 34, x1 - 35, top + 115), title, 48, WHITE)
    box_top = top + 165
    box_h = 179
    box_gap = 30
    boxes = []
    for i, value in enumerate(steps):
        y0 = box_top + i * (box_h + box_gap)
        box = (x0 + 64, y0, x1 - 64, y0 + box_h)
        boxes.append(box)
        d.rounded_rectangle(box, radius=25, fill=light, outline=accent, width=3)
        text_center(d, box, value, 34, spacing=8)
    if show_arrows:
        for a, b in zip(boxes, boxes[1:]):
            mid_x = (a[0] + a[2]) / 2
            arrow(d, (mid_x, a[3] + 5), (mid_x, b[1] - 6), accent, 6, 17)


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    d = ImageDraw.Draw(image)
    d.text((112, 73), "阶段 1 · 同一行为的两版路径", font=font(72), fill=INK)
    d.text((118, 178), "编辑器浏览器预览当前场景 → 场景启动 → 首次绘制", font=font(34), fill=MUTED)
    left = [
        "index.js\n建立全局 cc",
        "boot.js\n加载预览脚本与资源包",
        "cc.game.run\n内部异步准备",
        "ENGINE_INITED → GAME_INITED\n调用 onStart",
        "preview-scene.json\n→ runSceneImmediate",
        "director.mainLoop\n→ renderer.render → AFTER_DRAW",
    ]
    right = [
        "exports/base.ts\n构建引擎模块",
        "preview-app/main.js\n导入 cc 并设置预览启动",
        "game.init\nBase → Infra → Subsystem → Project",
        "GAME_INITED → game.run\nPacer 启动",
        "current_scene.json\n→ runSceneImmediate",
        "Director.tick\n→ Root.frameMove → AFTER_DRAW",
    ]
    draw_column(d, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT)
    draw_column(d, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT)
    d.rounded_rectangle((110, 1800, 2290, 1955), radius=30, fill="#EAF0F4")
    text_center(d, (145, 1810, 2255, 1945),
                "共同：预览宿主显式加载场景 JSON 并调用 runSceneImmediate\n差异：2.4 在 run 内准备；3.8 先 init，再由 run / Pacer 驱动", 32, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage1-2.4-startup.png",
        "2.4.15 · 从预览入口到首帧",
        "当前 Hello World 场景 · Creator Chrome 预览",
        [
            ("01  模块装配", ["index.js\n创建全局 cc", "predefine / cocos2d\n/ extends", "cc.game 与\ncc.director 就绪"]),
            ("02  预览宿主", ["settings.js\n指向 helloworld.fire", "boot.js\n加载脚本与 Bundle", "cc.game.run\n(option, onStart)"]),
            ("03  引擎初始化", ["_initConfig → prepare\n→ _loadPreviewScript", "_initEngine\n→ ENGINE_INITED", "Director.init；内建资源\n与帧请求准备", "安排主循环\n→ GAME_INITED → onStart"]),
            ("04  首场景入场", ["onStart：pause\n→ loadAny 预览 JSON", "SceneAsset.scene\n→ runSceneImmediate", "onBeforeLoadScene\n回调：resume", "BEFORE_SCENE_LAUNCH\n→ Scene 激活\n→ AFTER_SCENE_LAUNCH"]),
            ("05  首个已观测场景帧", ["director.mainLoop\n计算 dt", "start → update\n→ Scheduler → lateUpdate", "AFTER_UPDATE\n→ 延迟销毁", "BEFORE_DRAW\n→ renderer.render\n→ AFTER_DRAW"]),
        ], BLUE, BLUE_LIGHT,
    )
    make_detail(
        OUT / "stage1-3.8-startup.png",
        "3.8.7 · 从预览入口到首帧",
        "当前 main 场景 · Creator Chrome 预览",
        [
            ("01  模块与宿主", ["exports/base.ts\n构建引擎模块", "页面加载 SystemJS\n与引擎 bundle", "preview-app/index.js\n→ main.js", "导入 cc；清空运行时\nlaunchScene"]),
            ("02  Game.init 四阶段", ["Base\n日志 / sys / settings", "Infrastructure\n画布 / 设备 / 资源 / Pacer", "Subsystem\nDirector.init / Root\n→ ENGINE_INITED", "Project\n渲染管线 / 项目脚本\nRENDERER_INITED\n→ GAME_INITED"]),
            ("03  游戏开始运行", ["game.init\nPromise 完成", "game.run\n启动 Pacer", "_updateCallback\n处理启动分支", "startAnimation\n→ onStart"]),
            ("04  首场景入场", ["请求\ncurrent_scene.json", "assetManager\n.loadWithJson", "director\n.runSceneImmediate", "BEFORE_SCENE_LAUNCH\n→ Scene 激活\n→ AFTER_SCENE_LAUNCH"]),
            ("05  首个已观测场景帧", ["后续 Pacer 回调\n→ Director.tick(dt)", "BEGIN_FRAME / 输入\n→ 组件与系统 update", "lateUpdate / AFTER_UPDATE\n→ 延迟销毁", "Root.frameMove\n→ AFTER_DRAW\n→ END_FRAME"]),
        ], PURPLE, PURPLE_LIGHT,
    )
    make_comparison(OUT / "stage1-startup-comparison.png")
    for name in ("stage1-2.4-startup.png", "stage1-3.8-startup.png", "stage1-startup-comparison.png"):
        with Image.open(OUT / name) as result:
            print(f"{name}: {result.width}x{result.height}")


if __name__ == "__main__":
    main()
