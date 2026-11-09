# 第 19 课（CPP11）：RAII 与资源管理

**目标：** 让资源句柄对象在构造时取得资源，并在离开作用域时自动释放资源。

## 本课问题

- RAII 怎样把资源的取得和释放与对象生命周期配对？
- `std::ofstream` 怎样管理打开的文件？
- 为什么不需要在每条执行路径上手动调用 `close()`？

## 代码结构

~~~text
s19_cpp_raii/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
{
    std::ofstream output{path};
    output << "asset=forest\n";
} // output 离开作用域，文件流自动关闭
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s19
/tmp/learn-cpp-s19
~~~

预期输出：

~~~text
writer open: true
writer scope ended
read back: asset=forest
temporary file removed
~~~

## 观察要点

- RAII 将资源生命周期绑定到对象生命周期：资源句柄对象取得资源后负责管理它，对象析构时释放资源。
- `std::ofstream` 构造时打开文件；它内部的文件缓冲对象在析构时关闭文件。示例离开写入作用域后，另一个 `std::ifstream` 能重新打开并读出内容。
- 写入流即使因 `return` 离开作用域，也会先析构并关闭文件；不必在每条路径上手工补上 `close()`。
- 读入流同样由自己的作用域管理，并在作用域结束时关闭。文件路径本身不是文件句柄；代码最后用 `std::remove` 删除临时文件。
- 标准库的 `std::string`、`std::vector` 和文件流都体现了资源由对象管理的思路。使用这些类型可以避免自己配对底层申请与释放操作。
- 如果资源已有可靠的标准库句柄，优先使用它；只有在需要封装额外资源或策略时才考虑编写自定义资源管理类型。

## 动手练习

1. 在写入作用域中加入一次提前 `return`，再观察离开作用域时文件流仍会析构。
2. 把输出内容改成其他资源名称，观察读回内容的变化。
3. 对照示例尝试手动调用 `close()`，再移除该调用，确认普通作用域退出仍能完成关闭。

## 简化说明

- 示例使用 `/tmp/learn-cpp-s19-raii.txt` 作为临时文件，正常运行后会删除它；文件打开或读写失败时程序会报告错误。
- 示例只使用标准文件流，不涉及裸 `new/delete`、智能指针、锁、异常安全细节或自定义资源句柄。
- 课程展示标准库类型如何实现 RAII，不把输出日志当作资源释放机制。

## 参考资料

- [C++ 工作草案：文件流](https://eel.is/c++draft/ofstream)
- [C++ 工作草案：文件缓冲区析构时关闭文件](https://eel.is/c++draft/filebuf)
- [C++ Core Guidelines：R.1 使用资源句柄与 RAII 自动管理资源](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
