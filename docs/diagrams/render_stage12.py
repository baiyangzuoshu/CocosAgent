#!/usr/bin/env python3
"""Render three Stage 12 editor extension and diagnostics diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER_2 = "2.4 菜单 ping 已实测；初次 load / Reload 后 unload-load 时点与 Mac 包引擎来源仍待取证。"
FOOTER_3 = "3.8 菜单 load/ping 已实测；Profiler 宏仅经聚焦语法编译，未完成 Native 构建或性能测量。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 12 · 编辑器扩展与诊断对照", font=font(72), fill=INK)
    draw.text((118, 178),
              "比较项目扩展、构建入口、引擎来源和性能诊断的证据",
              font=font(34), fill=MUTED)
    left = [
        "扩展位置｜packages/\npackage.json 的 main-menu → 主入口消息",
        "本次验收｜完整重开后发现包\nPackages 菜单点击 → messages.ping 日志",
        "构建扩展｜build-templates / Editor.Builder\n本例均无实际构建钩子轨迹",
        "引擎来源｜gulp 只编译引擎脚本\n现有 builder 配置无路径，Mac 来源未知",
        "游戏内统计｜setDisplayStats → cc.profiler\nDirector 更新 / 绘制事件提供数据",
        "证据边界｜Creator 宿主源码缺席\n扩展 load / unload 精确时点未取得",
    ]
    right = [
        "扩展位置｜extensions/\npackage_version:2 + contributions.messages",
        "本次验收｜管理器刷新 / 启用见 load\nDevelop 菜单点击 → methods.ping 日志",
        "构建扩展｜build-templates / builder hooks\n独立 worker 与主入口消息分离；本例未测",
        "引擎来源｜现有 Mac 配置 TS/Native=builtin\n路径为 Creator 安装目录，非邻接源码",
        "游戏内统计｜profiler.showStats\n另有需重新编译的 Native C++ Profiler",
        "聚焦修复｜CC_PROFILE_OBJECT_INC 拼写\n宏开/关均通过 Clang 语法编译",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT, show_arrows=False)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT, show_arrows=False)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两版菜单消息闭环已在对应 Creator 中验证；完整编辑器宿主实现不在引擎仓库\n源码改动要进入项目，仍须确认引擎选择、重新构建并核对新产物",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage12-2.4-editor-extension-and-diagnostics.png",
        "2.4.15 · 编辑器扩展与工程诊断",
        "项目包菜单消息已验收 · 引擎来源证据仍不足",
        [
            ("01  项目扩展消息", ["packages/\nstage12-editor-probe", "package.json\nmain-menu 指向 ping", "完整重开工程\nPackage Manager 发现包", "点击 Packages 菜单\nmain.js::messages.ping"]),
            ("02  引擎来源（并列证据）", ["cocos2d/ 是\n邻接引擎源码", "gulp build-dev\n只编译引擎脚本", "两份 builder 配置\n没有引擎路径", "现有 Mac 包\n来源仍未知"]),
            ("03  构建入口（并列）", ["build-templates/\n按平台覆盖文件", "Editor.Builder\n项目构建事件", "示例没有\nbuild-templates 源", "构建钩子\n本阶段未运行"]),
            ("04  游戏内统计", ["非 Canvas 模式\nsetDisplayStats", "转到 cc.profiler\nshowStats / hideStats", "订阅 Director\n更新与绘制事件", "显示游戏内帧统计\n不是 C++ 剖析"]),
            ("05  诊断顺序（方法）", ["先判编辑器 / 构建\n还是引擎运行", "查对应手册入口\n及项目源文件", "核对自定义引擎\n设置 / 产物标记", "按实际目标预览\n或重新发布验证"]),
        ], BLUE, BLUE_LIGHT, FOOTER_2,
        independent_sections=(1, 2), detached_sections=(0, 1, 2, 3, 4),
    )
    make_detail(
        OUT / "stage12-3.8-editor-extension-and-diagnostics.png",
        "3.8.7 · 编辑器扩展与工程诊断",
        "项目扩展 load / ping 已验收 · 现有 Mac 包明确使用内置引擎",
        [
            ("01  项目扩展消息", ["extensions/\nstage12-editor-probe", "package_version: 2\ncontributions 映射 ping", "管理器刷新 / 启用\ndist/main.js::load", "点击 Develop 菜单\nmethods.ping 日志"]),
            ("02  引擎来源（并列证据）", ["npm run build:dev\n只编译邻接引擎", "Engine Manager\n分别选 TS / Native", "Mac 构建配置\n二者均为 builtin", "现有包指向 Creator\n安装目录内引擎"]),
            ("03  构建入口（并列）", ["build-templates/\n按目标平台覆盖", "builder hooks\n在独立 worker 执行", "示例没有\n构建模板源", "构建 worker\n本阶段未运行"]),
            ("04  两级性能统计（并列）", ["profiler.showStats\n游戏内覆盖层", "Director / GFX\n提供帧统计", "Native Profiler 需\nCC_USE_PROFILER=1", "Native C++ 统计\n须重新编译目标"]),
            ("05  聚焦源码修复", ["CC_PROFILE_OBJECT_INC\n原宏引用 C_PROFILER", "开启 Profiler 时\nClang 语法报错", "修为 CC_PROFILER\n只改一处标识符", "宏开启 / 关闭\n语法编译均通过"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER_3,
        independent_sections=(1, 2, 3), detached_sections=(0, 1, 2, 3, 4),
    )
    make_comparison(OUT / "stage12-editor-extension-and-diagnostics-comparison.png")
    for name in (
        "stage12-2.4-editor-extension-and-diagnostics.png",
        "stage12-3.8-editor-extension-and-diagnostics.png",
        "stage12-editor-extension-and-diagnostics-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
