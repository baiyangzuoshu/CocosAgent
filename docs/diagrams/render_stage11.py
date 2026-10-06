#!/usr/bin/env python3
"""Render three Stage 11 auxiliary capability diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER_2 = "当前 Mac 包局部轨迹；2.4 原生网络/存储/热更新 C++ 实现缺席，Web 与小游戏另验。"
FOOTER_3 = "3.8 本包状态 13 对应 C++ UP_TO_DATE，包内 JS 却标 FAIL_TO_UPDATE；Web/小游戏另验。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 11 · 辅助能力的六组对照", font=font(72), fill=INK)
    draw.text((118, 178),
              "业务网络、存储和文件热更新以两版现有 Mac 包为实测范围",
              font=font(34), fill=MUTED)
    left = [
        "HTTP 503｜XHR 仍进 onload\n业务代码检查 status",
        "连接拒绝｜XHR timeout=4s\n本包两轮进入 ontimeout",
        "WebSocket｜TCP 重置仅 open→close\n403 握手 error→close；5 字节回显成功",
        "存储｜cc.sys.localStorage\n临时值跨进程重启可读，删后 null",
        "热更新｜jsb.AssetsManager ≠ assetManager\n单文件事件 8；状态 12 与 JS 一致",
        "多语言 / SDK｜外部 i18n 插件\n具体 SDK 从项目原生工程追踪",
    ]
    right = [
        "HTTP 503｜XHR onload、fetch resolve\n业务代码检查 status",
        "连接拒绝｜XHR onerror\nfetch rejected（同一受控端口）",
        "WebSocket｜TCP 重置仅 open→close\n403: code=0 / clean=true 非成功；5B 回显",
        "存储｜sys.localStorage\n临时值跨进程重启可读，删后 null",
        "热更新｜native.AssetsManager ≠ assetManager\n单文件事件 8；状态 13 与包内 JS 错位",
        "多语言 / SDK｜编辑器 L10N\n具体 SDK 经原生工程和 JSB Bridge",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT, show_arrows=False)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT, show_arrows=False)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两版的 checkUpdate() 发现新版本时均未下载资源；随后 update() 才下载哨兵文件\n重启只验证构造管理器后读到缓存 1.0.1，不证明新版游戏脚本在启动前生效",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage11-2.4-auxiliary-capabilities.png",
        "2.4.15 · 辅助能力",
        "当前 Mac 已发布包 · 业务网络、存储与原生热更新分别诊断",
        [
            ("01  业务 HTTP", ["游戏脚本调用\nXMLHttpRequest", "原生 XHR 宿主\n实现未在本工作区", "本包 200 / 503\n均触发 onload", "检查 status\n再决定业务结果"]),
            ("02  WebSocket（并列切口）", ["Native Socket 已编入\n全局 WebSocket 可用", "文本 + 5 字节\n回显成功", "TCP 重置\n只见 open → close", "403 拒绝握手\nerror → close"]),
            ("03  本地存储", ["cc.sys.localStorage\n公开访问面", "JSB 分支指向\nwindow.localStorage", "唯一临时键\nsetItem / getItem", "Mac 重启后仍可读\nremoveItem 后 null"]),
            ("04  原生热更新", ["jsb.AssetsManager\n不是 cc.assetManager", "checkUpdate 代码 3\n只发现新版本清单", "update 下载单文件\n事件 8 完成", "缓存路径前置\n重启后读版本 1.0.1"]),
            ("05  工程外能力（并列）", ["游戏多语言\n官网为外部 i18n 插件", "本例未安装插件\n无运行链证据", "平台 SDK 依目标\n原生工程 / JSB 反射", "本例未集成\n具体第三方 SDK"]),
        ], BLUE, BLUE_LIGHT, FOOTER_2,
        independent_sections=(1, 4), detached_sections=(0, 1, 2, 3, 4),
    )
    make_detail(
        OUT / "stage11-3.8-auxiliary-capabilities.png",
        "3.8.7 · 辅助能力",
        "当前 Mac 包使用 Creator 内置引擎；邻接源码只解释实现设计",
        [
            ("01  业务 HTTP", ["游戏脚本调用\nfetch(url)", "Native fetch 适配\n基于 XMLHttpRequest", "本包 fetch(503)\n仍然 resolve", "检查 status\n再决定业务结果"]),
            ("02  WebSocket（并列切口）", ["Socket 模块已编入\n全局 / jsb 构造器可用", "文本 + 5 字节\n回显成功", "TCP 重置\n只见 open → close", "403 拒绝握手\nerror → close"]),
            ("03  本地存储", ["sys.localStorage\n公开访问面", "Native 窗口 / JSB\n邻接源码接 SQLite", "唯一临时键\nsetItem / getItem", "Mac 重启后仍可读\nremoveItem 后 null"]),
            ("04  原生热更新", ["native.AssetsManager\n不是 assetManager", "checkUpdate 代码 3\n只发现新版本清单", "update 下载单文件\n事件 8 完成", "缓存路径前置\n重启后读版本 1.0.1"]),
            ("05  工程外能力（并列）", ["游戏多语言\n官网为编辑器 L10N", "本例未启用 L10N\n引擎仓库缺编辑器实现", "平台 SDK 依目标\n原生工程 / JSB Bridge", "本例未集成\n具体第三方 SDK"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER_3,
        independent_sections=(1, 4), detached_sections=(0, 1, 2, 3, 4),
    )
    make_comparison(OUT / "stage11-auxiliary-capabilities-comparison.png")
    for name in (
        "stage11-2.4-auxiliary-capabilities.png",
        "stage11-3.8-auxiliary-capabilities.png",
        "stage11-auxiliary-capabilities-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
