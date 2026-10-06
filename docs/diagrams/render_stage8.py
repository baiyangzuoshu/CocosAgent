#!/usr/bin/env python3
"""Render three Stage 8 animation and effects diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "独立链路：剪辑/Tween 有固定时钟 Web 轨迹；音频、粒子与骨骼各有单独证据边界。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 8 · 动画与表现的六条能力线", font=font(72), fill=INK)
    draw.text((118, 178),
              "剪辑、Tween、音频、2D/3D 粒子、骨骼动画分别比较",
              font=font(34), fill=MUTED)
    left = [
        "Clip.createCurves\nAnimationManager 逐曲线写属性",
        "ActionManager 先于动画\n同写 x：固定时钟剪辑最终 100",
        "AudioSource 与 audioEngine 分开\n后者按同 URL 的 ID 限额",
        "2D stopSystem 停发射\n排空后可 node.destroy",
        "3D ParticleSystem3D.stop 清粒\n手停后 isEmitting 可仍为 true",
        "SkeletonAnimationClip\n关节矩阵写 CPU 节点再上传",
    ]
    right = [
        "Clip.createEvaluator / PoseOutput\nAnimationManager 应用混合缓冲",
        "AnimationManager 先于 TweenSystem\n同写位置：固定时钟 Tween 最终 200",
        "AudioSource / playOneShot\n合计额度，优先淘汰旧 one-shot",
        "2D stopSystem 停发射\n渲染标志重算时机影响可见性",
        "3D stopEmitting 可排空\nstop 清粒且清 isEmitting",
        "SkeletalAnimation baked\n帧索引 + 共享骨骼贴图",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT, show_arrows=False)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT, show_arrows=False)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "同属性结果只限本次固定时钟探针；音频与粒子为各自 Web 条件下的局部轨迹\n3.8 士兵 baked 帧索引已观测；2.4 示例无骨骼运行证据，原生仍需另验",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage8-2.4-animation-and-effects.png",
        "2.4.15 · 动画与表现能力",
        "五组独立入口 · 当前引擎源码与 Creator Web 探针",
        [
            ("01  普通剪辑", ["cc.Animation.play\n选择 Clip / State", "AnimationClip\ncreateCurves", "AnimationManager.update\n逐曲线采样", "直接写目标属性\n状态事件延迟派发"]),
            ("02  Tween / Action", ["cc.tween(node).start()\n构成 TweenAction", "Director 的\nActionManager", "系统调度先于\nAnimationManager", "同写 x：后来的剪辑\n固定时钟最终 100"]),
            ("03  音频入口（并列）", ["AudioSource\n组件停用会 stop", "cc.audioEngine\n独立受管播放 ID", "同 nativeUrl 的 ID\n达到上限淘汰最早者", "AudioClip.destroy\nuncache 停对应 ID"]),
            ("04  2D 粒子", ["cc.ParticleSystem\nresetSystem 发射", "lateUpdate\nSimulator.step", "stopSystem 停发射\n旧粒子继续模拟", "粒子排空后\nautoRemove 销毁节点"]),
            ("05  3D 专项（并列）", ["SkeletonAnimationClip\n可预计算关节矩阵", "SkinnedMeshRenderer\n组装矩阵后上传", "ParticleSystem3D.stop\n清粒；不清 isEmitting", "3D 无 2D 的\nautoRemoveOnFinish"]),
        ], BLUE, BLUE_LIGHT, FOOTER,
        independent_sections=(2, 4), detached_sections=(0, 1, 2, 3, 4),
    )
    make_detail(
        OUT / "stage8-3.8-animation-and-effects.png",
        "3.8.7 · 动画与表现能力",
        "五组独立入口 · 当前引擎源码与 Creator Web 探针",
        [
            ("01  普通剪辑", ["Animation.play\n或 crossFade", "AnimationClip\ncreateEvaluator", "PoseOutput / 混合缓冲\n统一应用姿态", "AnimationManager\n延迟派发状态事件"]),
            ("02  Tween 系统", ["tween(node).start()\n生成最终 Action", "TweenSystem 内的\nActionManager", "更新晚于\nAnimationManager", "同写位置：Tween\n固定时钟最终 200"]),
            ("03  音频入口（并列）", ["AudioSource 普通播放\n停用 pause / 销毁 stop", "playOneShot\n独立一次性播放器", "AudioManager 合计额度\n优先淘汰旧 one-shot", "异步 one-shot 可在\n源节点销毁后迟到启动"]),
            ("04  2D 粒子", ["ParticleSystem2D\nresetSystem 发射", "lateUpdate\nSimulator.step", "stopSystem 停发射\n旧粒子继续模拟", "排空可销毁节点\n渲染标志重算另查"]),
            ("05  3D 专项（并列）", ["SkeletalAnimation baked\n推进共享贴图帧索引", "Socket 单独\nCPU 更新目标节点", "3D ParticleSystem\nstopEmitting 可排空", "3D stop 清粒\n实验性姿态图另查"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER,
        independent_sections=(2, 4), detached_sections=(0, 1, 2, 3, 4),
    )
    make_comparison(OUT / "stage8-animation-and-effects-comparison.png")
    for name in (
        "stage8-2.4-animation-and-effects.png",
        "stage8-3.8-animation-and-effects.png",
        "stage8-animation-and-effects-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
