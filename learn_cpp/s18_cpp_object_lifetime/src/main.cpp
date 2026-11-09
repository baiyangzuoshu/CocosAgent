#include <iostream>
#include <string>

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

private:
    std::string name_;
};

int main()
{
    std::cout << "enter main\n";
    LifetimeTrace player{"player"};

    {
        LifetimeTrace projectile{"projectile"};
        LifetimeTrace effect{"effect"};
        std::cout << "leave inner scope\n";
    }

    std::cout << "back in main\n";
    std::cout << "leave main\n";
    return 0;
}
