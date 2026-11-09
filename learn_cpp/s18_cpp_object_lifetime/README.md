# 第 18 课（CPP10）：对象生命周期与析构函数

**目标：** 观察局部对象何时构造、何时析构，以及同一作用域中的销毁顺序。

## 本课问题

- 对象离开作用域时会发生什么？
- 析构函数的写法与调用时机是什么？
- 同一作用域创建多个对象时，它们按什么顺序销毁？

## 代码结构

~~~text
s18_cpp_object_lifetime/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
class LifetimeTrace {
public:
    explicit LifetimeTrace(const std::string& name)
        : name_{name}
    {
        std::cout << "construct: " << name_ << '\n';
    }

    ~LifetimeTrace()
    {
        std::cout << "destroy: " << name_ << '\n';
    }
};
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s18
/tmp/learn-cpp-s18
~~~

预期输出：

~~~text
enter main
construct: player
construct: projectile
construct: effect
leave inner scope
destroy: effect
destroy: projectile
back in main
leave main
destroy: player
~~~

## 观察要点

- 析构函数写作 `~类名()`，没有返回类型和参数；对象生命周期结束时，编译器会自动调用它。
- `projectile` 和 `effect` 都在内层代码块中创建。离开代码块时，先销毁后创建的 `effect`，再销毁 `projectile`。
- 外层的 `player` 在内层代码块结束后仍然存在；`main()` 返回、离开外层作用域时，才调用它的析构函数。
- 局部自动对象的销毁顺序与构造顺序相反。离开作用域、包括从该作用域返回时，都会结束这些对象的生命周期。
- `LifetimeTrace` 的析构函数只打印观察信息。类的数据成员 `name_` 会在析构函数体结束后自动析构，不需要手动调用它的析构函数。
- 并非每个类都需要自定义析构函数；如果编译器生成的析构函数已能处理成员，通常使用默认析构即可。标准库成员会管理自己的生命周期。

## 动手练习

1. 在内层作用域再创建一个 `LifetimeTrace`，观察析构顺序如何变化。
2. 把 `projectile` 移到外层作用域，比较它与 `player` 的销毁时机。
3. 暂时移除自定义析构函数，观察打印消失；确认 `std::string` 成员仍会自动析构。

## 简化说明

- 示例只观察自动存储期对象，不涉及动态分配、异常展开、继承或多线程。
- 析构函数没有释放手动管理的资源；资源获取与释放的配对将在下一课学习。
- 终端输出用于显示调用顺序，不代表析构函数通常应该打印日志。

## 参考资料

- [C++ 工作草案：析构函数](https://eel.is/c++draft/class.dtor)
- [C++ 工作草案：对象生命周期](https://eel.is/c++draft/basic.life)
- [C++ Core Guidelines：C.30（需要时再定义析构函数）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
