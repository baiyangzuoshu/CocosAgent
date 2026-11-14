# 第 12 课：GDScript tokenizer、parser 与脚本验证

**目标：** 从文本 tokenizer 追到 parser AST 与 GDCompiler，再看 GDScript::reload 如何串起解析、编译和错误回报。

## 本课问题

脚本源文本何时切成 token？parse 成功后编译器生成什么？语法错误与编译错误在哪一阶段报告？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-1.1/` 快照。
- `engine/godot-1.1/modules/gdscript/gd_tokenizer.cpp:933-939`：摘录包含本课的关键函数实现。
- `engine/godot-1.1/modules/gdscript/gd_parser.cpp:2782-2804`：摘录包含本课的关键函数实现。
- `engine/godot-1.1/modules/gdscript/gd_compiler.cpp:1668-1688`：摘录包含本课的关键函数实现。
- `engine/godot-1.1/modules/gdscript/gd_script.cpp:1823-1875`：摘录包含本课的关键函数实现。

调用链：`source text → GDTokenizerText::get_token → GDParser::parse → GDCompiler::compile → GDScript::reload`

## 源码阅读顺序

1. `GDTokenizerText::get_token` 从文本流取下一个 token，并维护当前词法位置；先检查标识符、常量和运算符如何成为 token。
2. `GDParser::parse` 消费 token 并建立语法结构；从函数声明和表达式分支看语法错误如何被记录。
3. `GDCompiler::compile` 遍历解析结果并生成函数执行所需的数据；确认 compile 输入已经是 parser 产物。
4. `GDScript::reload` 串起解析与编译、清理旧结果并汇总错误，是脚本重载对外的阶段入口。

旧版 GDScript 以 GDTokenizerText 读取源码 token，GDParser 建立语法结构，GDCompiler 生成运行所需函数代码。GDScript::reload 负责清理/更新脚本数据并按阶段检查错误；Godot 1.1/2.1 的阶段名相近，但源码细节按各自快照引用。

## 最小 Godot/GDScript 实验

主场景挂载一个含常量、变量、函数参数和简单表达式的脚本；运行时调用函数并打印结果。引擎加载主场景前必须先解析/编译这段脚本。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)
- [`compile_probe.gd`](compile_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
```

**预期观察：** 预期计算结果为 13。实验能观察成功脚本的执行，不代表自动覆盖语法错误路径。

**动手改一处：** 把函数参数类型（4.7）或表达式中的一个 token 改成错误值，先判断错误属于 parse、analysis 还是 compile 阶段；完成后恢复有效脚本。

## 简化与边界

实验只走有效脚本路径，不刻意引入 parse error；静态源码分别说明 tokenizer、parser、analyzer（仅 4.7）和 compiler 的职责。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [gd_tokenizer.cpp](src/upstream/modules/gdscript/gd_tokenizer.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_tokenizer.cpp` | 933-939 |
| [gd_parser.cpp](src/upstream/modules/gdscript/gd_parser.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_parser.cpp` | 2782-2804 |
| [gd_compiler.cpp](src/upstream/modules/gdscript/gd_compiler.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_compiler.cpp` | 1668-1688 |
| [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_script.cpp` | 1823-1875 |

## 下一课

[第 13 课：GDScript 实例属性与方法调用](../s13_gdscript_instance/README.md)
