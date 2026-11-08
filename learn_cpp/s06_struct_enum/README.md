# 第 6 课（C05）：结构体、枚举与结构体指针

**目标：** 用结构体把相关数据组合成一个对象，用枚举表示有限状态，并通过结构体指针访问或修改对象成员。

## 本课问题

- 结构体怎样把多个字段组合起来？
- 枚举常量如何表示一组有限状态？
- 结构体变量和结构体指针分别用什么语法访问成员？

## 代码结构

~~~text
s06_struct_enum/
├── README.md
└── src/
    └── main.c
~~~

## 示例程序

示例把角色的生命值、位置和状态放入一个 `Actor` 结构体。`apply_damage` 接收结构体指针，扣减生命值，并在生命值归零时切换枚举状态。

~~~c
typedef enum {
    ACTOR_IDLE,
    ACTOR_MOVING,
    ACTOR_DISABLED
} ActorState;

typedef struct {
    int health;
    int x;
    int y;
    ActorState state;
} Actor;
~~~

完整程序位于 `src/main.c`。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c \
  -o /tmp/learn-cpp-s06
/tmp/learn-cpp-s06
~~~

预期输出：

~~~text
initial health: 100
position: (6, 7)
health after damage: 0
state: disabled
~~~

## 观察要点

- `Actor` 把几个相关字段组合到一个类型中；`hero.health` 用点号访问结构体变量的成员。
- `ActorState` 列出本例允许的状态；枚举常量可直接用于比较和赋值。
- `Actor *hero_ptr = &hero` 保存结构体地址；`hero_ptr->x` 访问指针所指结构体的成员。
- `hero_ptr->x` 等价于 `(*hero_ptr).x`。括号不能省略，因为 `.` 的优先级高于一元 `*`。
- `apply_damage(&hero, 120)` 把结构体地址传入函数，函数通过指针修改原对象。

## 动手练习

1. 添加一个 `mana` 字段，并在输出中观察它。
2. 加入 `ACTOR_MOVING` 状态，尝试改变状态并比较枚举值。
3. 增加一个接收 `Actor *` 的函数，修改角色坐标。

## 简化说明

- 结构体字段全部公开；本课不讨论不透明类型和头文件接口设计。
- 示例只用一个角色，不建立对象数组。
- 枚举底层值由 C 实现选择；本例只依赖枚举常量的相等比较。
