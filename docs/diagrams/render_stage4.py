#!/usr/bin/env python3
"""Render three Stage 4 asset lifecycle diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "范围：两版 Chrome/Mac 已验证 JSON 与磁盘场景分支；其他平台需另验。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 4 · 资源身份、加载与释放", font=font(72), fill=INK)
    draw.text((118, 178),
              "同一行为：按路径取资源 → 持有 / 释放 → 切换磁盘场景",
              font=font(34), fill=MUTED)
    left = [
        ".meta 主 / 子 UUID\n.fire 引用 SpriteFrame 子资源",
        "cc.resources / Bundle\npreload 只走 fetch；load 构造对象",
        "URL：parse → combine\n按 Bundle / UUID / 版本定位",
        "deserialize → 依赖填充\nAsset.onLoad（若适用）→ 普通缓存",
        "runSceneImmediate：先 _autoRelease\n再销毁旧 Scene",
        "decRef 非强制尝试释放\nreleaseAsset 强制释放根对象",
    ]
    right = [
        ".meta：主 UUID；子 UUID@ID\n.scene 引用 Prefab / 子资源",
        "resources / Bundle\npreload 只走 fetch；load 构造对象",
        "URL：parse → 可选覆盖 → combine\n目标 Bundle 须已加载",
        "deserialize → 依赖填充\nAsset.onLoaded（若适用）→ 普通缓存",
        "runSceneImmediate：先销毁旧 Scene\n再 _autoRelease",
        "decRef 非强制尝试释放\nreleaseAsset 强制释放根对象",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两版实测：旧场景独有资源降至 0 引用；autoReleaseAssets=false 仍缓存\n运行时设 true 后延迟移出缓存；源场景均保存 false，350ms 仅是采样点",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage4-2.4-assets-and-loading.png",
        "2.4.15 · 资源从身份到释放",
        "cc.resources / Bundle / Asset Manager · 浏览器预览与 Mac 包",
        [
            ("01  源资源身份", ["源文件 + .meta\n主 UUID / 子 UUID", "helloworld.fire\n引用 SpriteFrame 子 UUID", "Config 按 Bundle / 路径\n/ 类型查请求项", "解析 UUID、版本\n与 import/native URL"]),
            ("02  预加载", ["cc.resources.preload\n或 Bundle.preload", "preprocess → fetch\n下载请求与依赖", "返回请求项\n尚无完整 Asset", "仍需调用 load\n才能获得对象"]),
            ("03  加载与构造", ["cc.resources.load\n→ loadAny", "packManager / parser\n→ deserialize", "getDepends\n→ 填回依赖引用", "Asset.onLoad（若适用）\n→ 普通 Asset 缓存\n→ 回调"]),
            ("04  持有与释放", ["回调净 refCount\n不必然 +1", "长期持有\n显式 addRef", "非强制释放\n正引用仍保留", "decRef 至 0\n延后移出缓存并失效"]),
            ("05  场景切换", ["Bundle.loadScene\n只取得 SceneAsset", "director.loadScene\n进入新磁盘场景", "_autoRelease 递减\n旧 Scene 静态依赖", "旧 Scene 的开关：false\n零引用仍缓存；true\n延后释放"]),
        ], BLUE, BLUE_LIGHT, FOOTER,
    )
    make_detail(
        OUT / "stage4-3.8-assets-and-loading.png",
        "3.8.7 · 资源从身份到释放",
        "resources / Bundle / Asset Manager · 浏览器预览与 Mac 包",
        [
            ("01  源资源身份", ["源文件 + .meta\n主 UUID；子 UUID@ID", "main.scene\n引用 Prefab / skybox 子资源", "Config 按 Bundle / 路径\n/ 类型查请求项", "解析 UUID；可选覆盖\n再组合资源 URL"]),
            ("02  预加载", ["resources.preload\n或 Bundle.preload", "preprocess → fetch\n下载请求与依赖", "返回请求项\n尚无完整 Asset", "仍需调用 load\n才能获得对象"]),
            ("03  加载与构造", ["resources.load\n→ loadAny", "packManager / parser\n→ deserialize", "getDepends\n→ 填回依赖引用", "Asset.onLoaded（若适用）\n→ 普通 Asset 缓存\n→ 回调"]),
            ("04  持有与释放", ["回调净 refCount\n不必然 +1", "长期持有\n显式 addRef", "非强制释放\n正引用仍保留", "decRef 至 0\n延后移出缓存并失效"]),
            ("05  场景切换", ["Bundle.loadScene\n只取得 SceneAsset", "director.loadScene\n进入新磁盘场景", "旧 Scene destroy 后\n_autoRelease 递减依赖", "旧 Scene 的开关：false\n零引用仍缓存；true\n延后释放"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER,
    )
    make_comparison(OUT / "stage4-assets-and-loading-comparison.png")
    for name in (
        "stage4-2.4-assets-and-loading.png",
        "stage4-3.8-assets-and-loading.png",
        "stage4-assets-and-loading-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
