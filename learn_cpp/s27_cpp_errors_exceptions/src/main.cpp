#include <exception>
#include <iostream>
#include <memory>
#include <stdexcept>

class CleanupTrace {
public:
    ~CleanupTrace()
    {
        std::cout << "resource released\n";
    }
};

int build_count(int count)
{
    auto resource = std::make_unique<CleanupTrace>();
    if (count < 0) {
        throw std::invalid_argument{"count cannot be negative"};
    }
    return count;
}

int main()
{
    const int valid_count = build_count(3);
    std::cout << "valid result: " << valid_count << '\n';

    try {
        const int invalid_count = build_count(-1);
        std::cout << "invalid result: " << invalid_count << '\n';
    } catch (const std::exception& error) {
        std::cout << "caught: " << error.what() << '\n';
    }

    return 0;
}
