#!/usr/bin/env python3
"""Render three Stage 9 physics and spatial diagrams as PNG files."""

from pathlib import Path

from PIL import Image, ImageDraw

from render_stage1 import (
    BLUE, BLUE_LIGHT, INK, MUTED, PURPLE, PURPLE_LIGHT,
    draw_column, font, text_center,
)
from render_stage2 import make_detail


OUT = Path(__file__).resolve().parent
FOOTER = "依据：2.4/3.8 官网手册、本地源码及当前 Web 后端轨迹；Builtin、其他后端和原生需另验。"


def make_comparison(path):
    image = Image.new("RGB", (2400, 2050), "#F7F9FB")
    draw = ImageDraw.Draw(image)
    draw.text((112, 73), "阶段 9 · 物理与空间的六组对照", font=font(72), fill=INK)
    draw.text((118, 178),
              "先辨版本、维度、系统与实际后端，再解释事件和查询",
              font=font(34), fill=MUTED)
    left = [
        "2D 普通碰撞｜CollisionManager\nEnter / Stay / Exit；不解算刚体",
        "Box2D 自然帧｜update / Begin 读旧值\n同帧 lateUpdate 读回写值",
        "接触监听｜fixture 创建时登记\n仅改字段未补登记；重启 Collider 可重建",
        "2D 查询｜testPoint 为单个或 null\n本快照 AABB 查询仅收 Dynamic",
        "3D Cannon｜Kinematic / Static\n非 trigger 配对发 trigger Enter",
        "3D raycastClosest 返回结果对象\nBuiltin 3D 也实现射线",
    ]
    right = [
        "2D Builtin｜PhysicsSystem2D\nBEGIN / END；无 Stay 和完整动力学",
        "Box2D 自然帧｜update / lateUpdate / Begin 旧值\n2D AFTER_PHYSICS 才读回写值",
        "接触监听｜fixture 创建时登记\n仅改字段未补登记；apply() 可重建",
        "2D 查询｜testPoint 为复用数组\nBuiltin 2D raycast 返回空数组",
        "3D Bullet｜Kinematic / Static\n非 trigger 配对发 collision Enter",
        "3D raycastClosest 返回布尔值 + 结果字段\n扫掠仅 Bullet / PhysX 有实现",
    ]
    draw_column(draw, 100, 1170, 300, "2.4.15", left, BLUE, BLUE_LIGHT, show_arrows=False)
    draw_column(draw, 1230, 2300, 300, "3.8.7", right, PURPLE, PURPLE_LIGHT, show_arrows=False)
    draw.rounded_rectangle((110, 1800, 2290, 1955), radius=30,
                           fill="#EAF0F4")
    text_center(draw, (145, 1810, 2255, 1945),
                "本次 3D 事件对照为不同后端：2.4 Cannon / 3.8 Bullet，不能推及全部后端\n两版自然帧和查询为当前 Web 局部轨迹；Builtin 事件及原生尚未实测",
                31, INK, 15)
    image.save(path, optimize=True)


def main():
    make_detail(
        OUT / "stage9-2.4-physics-and-spatial.png",
        "2.4.15 · 物理与空间能力",
        "三套管理器分治 · 当前 Web 预览的 3D 后端为 Cannon",
        [
            ("01  2D 普通碰撞", ["普通 Collider\n启用 CollisionManager", "更新世界形状\n组矩阵建立候选", "AABB + 几何相交\n计算接触状态", "节点脚本收到\nEnter / Stay / Exit"]),
            ("02  2D Box2D", ["RigidBody +\nPhysicsCollider", "PhysicsManager.update\n执行 World.Step", "监听已登记时\n触发 Begin 等回调", "Step 后同步节点\n本帧 lateUpdate 可读"]),
            ("03  2D 查询", ["PhysicsManager\ntestPoint / testAABB", "AABB 查询 fixture\n本快照只收 Dynamic", "testPoint 返回单个\nCollider 或 null", "testAABB 返回数组\n与点查询形状不同"]),
            ("04  3D 事件", ["构建宏绑定\nCannon / Builtin", "Collider3D.on 订阅\ntrigger-enter 等", "Physics3DManager\n启用后推进 World", "当前 Cannon 按\n触发 / 碰撞分派"]),
            ("05  3D 射线", ["世界 Ray +\n物理 Collider", "Physics3DManager\nraycastClosest", "当前 Cannon Web\n命中返回结果对象", "结果可复用\nBuiltin 3D 也有射线"]),
        ], BLUE, BLUE_LIGHT, FOOTER,
        independent_sections=(2, 4), detached_sections=(0, 1, 2, 3, 4),
    )
    make_detail(
        OUT / "stage9-3.8-physics-and-spatial.png",
        "3.8.7 · 物理与空间能力",
        "2D / 3D 分别选后端 · 当前 Web 为 TypeScript Box2D + Bullet",
        [
            ("01  2D Builtin", ["Collider2D\n选择 Builtin World", "更新 Shape\n双向组矩阵过滤", "AABB + 几何相交\n更新接触状态", "Collider / 系统收到\nBEGIN / END"]),
            ("02  2D Box2D", ["RigidBody2D +\nCollider2D", "lateUpdate 后进入\nPhysicsSystem2D.postUpdate", "World.step 中\n触发接触回调", "随后同步节点\nAFTER_PHYSICS 可读"]),
            ("03  2D 查询", ["PhysicsSystem2D\ntestPoint / testAABB", "委托当前 World\n收集 Collider", "返回复用数组\n跨查询需复制", "Builtin 的 raycast\n直接返回空数组"]),
            ("04  3D 事件", ["PhysicsSystem +\n当前 Bullet World", "Collider.on 订阅\nonTriggerEnter 等", "World.step 后\n按事件需求分派", "本次 Kinematic / Static\n非 trigger 发碰撞"]),
            ("05  3D 查询", ["世界 Ray +\n物理 Collider", "PhysicsSystem\nraycastClosest", "返回布尔值\n结果在系统字段", "Builtin 3D 可射线\n扫掠仅 Bullet / PhysX"]),
        ], PURPLE, PURPLE_LIGHT, FOOTER,
        independent_sections=(2, 4), detached_sections=(0, 1, 2, 3, 4),
    )
    make_comparison(OUT / "stage9-physics-and-spatial-comparison.png")
    for name in (
        "stage9-2.4-physics-and-spatial.png",
        "stage9-3.8-physics-and-spatial.png",
        "stage9-physics-and-spatial-comparison.png",
    ):
        with Image.open(OUT / name) as result:
            result.verify()
        print(name)


if __name__ == "__main__":
    main()
