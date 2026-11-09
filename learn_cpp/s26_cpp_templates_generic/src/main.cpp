#include <iostream>
#include <string>

template <typename T>
T larger(T left, T right)
{
    return left < right ? right : left;
}

template <typename T>
class Box {
public:
    explicit Box(const T& value)
        : value_{value}
    {
    }

    const T& get() const
    {
        return value_;
    }

private:
    T value_;
};

int main()
{
    std::cout << "larger int: " << larger(3, 7) << '\n';
    std::cout << "larger string: "
              << larger(std::string{"pear"}, std::string{"apple"}) << '\n';

    const Box<int> score{42};
    const Box<std::string> player_name{"player"};
    std::cout << "box<int>: " << score.get() << '\n';
    std::cout << "box<string>: " << player_name.get() << '\n';

    return 0;
}
