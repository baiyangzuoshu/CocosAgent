#!/usr/bin/env python3
"""Render three Stage 10 publishing and native startup diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "范围：当前 Mac 已发布包的事件回调；Web 仅有预览轨迹，正式 Web 包、小游戏与移动端另验。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 10 · 发布与原生的六组对照", font=font(72), fill=INK)
    draw.text((118, 178),
              "对照平台分叉、Mac 启动、帧驱动和发布包的引擎来源",
              font=font(34), fill=MUTED)
    left = [
        "平台分叉｜CC_JSB 宏 + CCSys.js\n小游戏再由目标适配器改写 sys",
        "Mac 宿主｜AppDelegate 启动 JSB\njsb-builtin.js → main.js",
        "脚本启动｜boot 加载引擎 / Bundle\ncc.game.run → onStart 加载启动场景",
        "本包事件｜game-inited / onStart\n场景前 AFTER_DRAW → 场景启动 → 场景帧",
        "帧驱动｜JSB 适配器 rAF\nCCGame → director.mainLoop",
        "引擎来源｜当前包配置未给路径\n2.4 C++ 帧率绑定源码不在工作区",
    ]
    right = [
        "平台分叉｜cc.config.json 映射 PAL\nsys 代理所选 system-info 实现",
        "Mac 宿主｜CocosApplication / BaseGame\nweb-adapter.js → main.js",
        "脚本启动｜SystemJS → application.js\ngame.init().then(game.run())",
        "本包事件｜post-base / post-subsystem\n场景前 AFTER_DRAW → 场景启动 → 场景帧",
        "帧驱动｜C++ Tick → gameTick → Pacer\nGame 启动分支后进入 director.tick",
        "引擎来源｜本包使用 Creator 内置引擎\n邻接 3.8.7engine 改动未进入该包",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT, show_arrows=False)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT, show_arrows=False)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两版 Mac 包都有 window / document，但 isNative=true、isBrowser=false\nWeb 一侧是预览，Mac 一侧是发布包；绘制回调不等于显示器呈现时间",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage10-2.4-publishing-and-native.png",
        "2.4.15 · 发布与原生启动",
        "当前 Mac 已发布包 · Creator 构建器与引擎来源尚未完全确定",
        [
            ("01  构建证据（并列）", ["local/builder.json\nMac / link 配置", "settings/builder.json\n启动场景 / 加密", "生成 main.js 与\njsb-adapter", "配置未记录\n引擎源码路径"]),
            ("02  Mac 宿主启动", ["AppDelegate.cpp\n启动 ScriptEngine", "加载 jsb-builtin.js\n提供宿主适配", "执行生成的 main.js\n加载设置 / 引擎", "window.boot()\ncc.game.run()"]),
            ("03  启动事件轨迹", ["boot →\nengine-inited", "game-inited / onStart\n加载启动场景", "首次 AFTER_DRAW\n仍在场景启动之前", "after-scene-launch\n→ 场景后 AFTER_DRAW"]),
            ("04  平台身份", ["构建注入 CC_JSB\n原生适配器提供全局", "CCSys.js\n判断 sys 属性", "本包 isNative=true\nisBrowser=false", "window / document 存在\n仍属于 Mac 原生"]),
            ("05  帧驱动", ["CCGame._setAnimFrame\n选择 JSB 分支", "设置原生目标帧率\n使用适配器 rAF", "宿主调用 gameTick\n精确实现不在引擎 JS", "帧回调进入\ndirector.mainLoop"]),
        ], BLUE, BLUE_LIGHT, FOOTER,
        independent_sections=(0,), detached_sections=(0, 1, 2, 3, 4),
    )
    make_detail(
        OUT / "stage10-3.8-publishing-and-native.png",
        "3.8.7 · 发布与原生启动",
        "当前 Mac 包使用 Creator 内置 TS / Native 引擎，非邻接源码",
        [
            ("01  构建证据（并列）", ["构建目标 Mac\n生成 data/main.js", "cocos.compile.config.json\n记录 engineInfo", "TypeScript / Native\n均为 builtin", "所指路径在 Creator\n安装目录内"]),
            ("02  Mac 宿主启动", ["CocosApplication /\nBaseGame 初始化 JSB", "运行 web-adapter.js\n再运行 main.js", "SystemJS 导入\napplication.js 与 cc", "载入 engine-adapter\ngame.init() → run()"]),
            ("03  启动事件轨迹", ["post-base-init →\npost-subsystem-init", "engine-inited →\ngame-inited", "首次 AFTER_DRAW\n仍在场景启动之前", "game.onStart / 场景启动\n→ 场景后 AFTER_DRAW"]),
            ("04  平台身份", ["cc.config.json\n将 Native 映射到 PAL", "pal/system-info/native\n读取 JSB 平台信息", "sys 对外代理\n所选 PAL 实现", "本包 isNative=true\nisBrowser=false；有 DOM 全局"]),
            ("05  帧驱动", ["C++ Engine::tick\n广播 Tick", "dispatchTickEvent\n调用脚本 gameTick", "Native Pacer\n驱动 Game 回调", "Game._updateCallback\n启动分支后 director.tick"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER,
        independent_sections=(0,), detached_sections=(0, 1, 2, 3, 4),
    )
    make_comparison(OUT / "stage10-publishing-and-native-comparison.png")
    for name in (
        "stage10-2.4-publishing-and-native.png",
        "stage10-3.8-publishing-and-native.png",
        "stage10-publishing-and-native-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
