# 第 1 课（C00）：编译、运行与源文件

**目标：** 理解 C 程序从源文件到可执行程序的基本过程，并看清头文件声明与源文件定义如何配合。

## 本课问题

- C 程序从哪个函数开始运行？
- 函数声明和函数定义分别放在哪里？
- 编译器如何把多个 `.c` 文件组合成一个可执行程序？

## 文件结构

~~~text
s01_c_toolchain/
├── README.md
└── src/
    ├── main.c       # 程序入口和调用方
    ├── greeting.h   # 函数声明
    └── greeting.c   # 函数定义
~~~

## 调用关系

~~~text
main.c
  ├── include greeting.h：读取 print_greeting 的声明
  └── 调用 print_greeting

greeting.c
  ├── include greeting.h：确认声明一致
  └── 定义 print_greeting

cc：编译两个源文件并链接成可执行程序
~~~

`main` 是程序入口。头文件提供 `print_greeting` 的声明；实现放在 `greeting.c`。使用编译器驱动 `cc` 并同时传入两个源文件，驱动会完成编译和链接。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c src/greeting.c \
  -o /tmp/learn-cpp-s01
/tmp/learn-cpp-s01
~~~

预期输出：

~~~text
program: main starts
Hello from greeting.c
program: main ends
~~~

`-std=c17` 选择 C17 语言标准；`-Wall -Wextra -Wpedantic` 打开常见警告，`-Werror` 将警告作为错误处理。输出程序放在 `/tmp`，不污染课程目录。

## 动手观察

1. 修改 `greeting.c` 中的问候文字，重新编译运行。
2. 在 `greeting.h` 声明一个 `print_farewell` 函数，在 `greeting.c` 实现，并从 `main.c` 调用。
3. 试着只编译 `src/main.c`，观察链接器关于 `print_greeting` 的提示；再把两个 `.c` 文件一起传给 `cc`。

## 简化说明

- 本课只构建单个可执行程序，不使用 Make 或 CMake。
- 头文件包含保护用于避免重复包含；本课暂不展开预处理器规则。
- 这里只学习 C 程序的编译与链接，不涉及 Cocos 引擎源码。
