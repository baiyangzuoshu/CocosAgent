#include <iostream>

namespace game {
bool is_alive(int health)
{
    return health > 0;
}
}

int main()
{
    int health = 100;
    int *selected_target = nullptr;

    std::cout << "health: " << health << '\n';
    std::cout << std::boolalpha;
    std::cout << "alive: " << game::is_alive(health) << '\n';

    if (selected_target == nullptr) {
        std::cout << "selected target: none\n";
    }

    return 0;
}
