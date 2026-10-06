#!/usr/bin/env python3
"""Render three Stage 6 graphics rendering diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "范围：2.4 Sprite 与 3.8 MeshRenderer 的桌面 Web 预览；其他管线与原生另验。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 6 · 场景对象到绘制提交", font=font(72), fill=INK)
    draw.text((118, 178),
              "同一行为：显示带材质对象 → 移动或换材质 → 当前相机绘制",
              font=font(34), fill=MUTED)
    left = [
        "Hello World：Sprite + SpriteFrame\nSimpleSpriteAssembler 生成顶点",
        "移动 Node → _renderFlag 变脏\n下一帧 RenderFlow 消耗",
        "setMaterial → MaterialVariant\n材质 / 纹理变化可触发 flush",
        "ModelBatcher → Model\nForwardRenderer 提取 Camera View",
        "BaseRenderer 按 Pass 设状态\nGFX Device.draw → WebGL",
        "移动：flag 136→128\n灰度材质：场景 draw 3→4",
    ]
    right = [
        "main.scene：MeshRenderer + Mesh\nModel / SubModel 加入 RenderScene",
        "移动 Node → hasChangedFlags\nRenderScene.update 更新边界 / UBO",
        "setSharedMaterial 改 Pass\ngetMaterialInstance 建独立实例",
        "Root 收集 Camera\nBuiltin WebPipeline 建 RenderGraph",
        "裁剪 / RenderQueue 录制命令\nGFX Queue.submit → present",
        "移动：边界中心 x 0→1\n换共享材质：场景 draw 仍 49",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15 · 2D", left, BLUE, BLUE_LIGHT)
    draw_column(draw, 1230, 2300, 300, "3.8.7 · 3D", right, PURPLE, PURPLE_LIGHT)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "两图取自不同类型的示例对象：2.4 也有 3D，3.8 也有 2D\n场景级 draw call 不能归因于单个对象，也不能用 3 与 49 比版本性能",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage6-2.4-graphics-rendering.png",
        "2.4.15 · Sprite 到 WebGL 绘制",
        "Hello World · RenderFlow / ModelBatcher / ForwardRenderer",
        [
            ("01  场景对象", ["Scene / Node\n持有 Sprite 组件", "SpriteFrame\n提供纹理与裁剪", "MaterialVariant\n归属该组件", "Main Camera\n选择可见层与目标"]),
            ("02  对象变更", ["移动 Node\n_renderFlag 标脏", "setMaterial\n建立 MaterialVariant", "Sprite 更新纹理\nmarkForRender", "下一帧\nRenderFlow 访问节点"]),
            ("03  生成渲染项", ["renderer.render\n→ RenderFlow", "SimpleSpriteAssembler\n更新顶点 / fillBuffers", "ModelBatcher\n按材质与纹理合批", "必要时 _flush\n建 Model / Effect"]),
            ("04  相机到绘制", ["ForwardRenderer\n提取 Camera View", "可见性 / 光照\n与渲染项排序", "BaseRenderer\n按 Effect Pass 设状态", "gfx Device.draw\n提交 WebGL"]),
            ("05  预览观测（并列）", ["移动后 flag\n136 → 128", "当前 Simple Sprite\n使用对应 assembler", "临时灰度材质\n场景 draw 3 → 4", "场景 draw 总数\n不能归因单个 Sprite"]),
        ], BLUE, BLUE_LIGHT, FOOTER, independent_sections=(4,),
    )
    make_detail(
        OUT / "stage6-3.8-graphics-rendering.png",
        "3.8.7 · MeshRenderer 到 GFX 绘制",
        "main.scene · RenderScene / Builtin WebPipeline / RenderGraph",
        [
            ("01  场景对象", ["MeshRenderer\nMesh / 子网格 / 材质槽", "建立 Model\n和 SubModel", "Model 加入\nRenderScene", "Camera / Light\n提供可见性与光照"]),
            ("02  对象变更", ["移动 Node\nhasChangedFlags 标脏", "setSharedMaterial\n改变共享材质槽", "SubModel 更新\n材质 Pass", "下一渲染帧\n更新 Model / 管线"]),
            ("03  帧内准备", ["Director.tick\n→ Root.frameMove", "Batcher2D 更新 / 上传\n然后汇入管线", "RenderScene.update\n边界 / 变换 / UBO", "相机排序\n→ WebPipeline.render"]),
            ("04  管线到提交", ["Builtin builder\n构造 forward Pass", "RenderGraph / SceneCulling\n建立可见队列", "RenderQueue\nCommandBuffer.draw", "GFX Queue.submit\n→ Device.present"]),
            ("05  预览观测（并列）", ["移动后 Model 边界\n中心 x：0 → 1", "共享材质切换\nSubModel Pass 同步", "getMaterialInstance\n惰性建独立材质", "该场景 draw=49\n不代表单模型成本"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER, independent_sections=(4,),
    )
    make_comparison(OUT / "stage6-graphics-rendering-comparison.png")
    for name in (
        "stage6-2.4-graphics-rendering.png",
        "stage6-3.8-graphics-rendering.png",
        "stage6-graphics-rendering-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
