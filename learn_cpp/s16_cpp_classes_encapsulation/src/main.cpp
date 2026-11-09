#include <iostream>

struct Position {
    int x;
    int y;
};

class Health {
public:
    void take_damage(int amount)
    {
        if (amount <= 0) {
            return;
        }

        if (amount >= current_) {
            current_ = 0;
        } else {
            current_ -= amount;
        }
    }

    int current() const
    {
        return current_;
    }

private:
    int current_{100};
};

int main()
{
    Position spawn{3, 5};
    std::cout << "spawn: " << spawn.x << ", " << spawn.y << '\n';

    Health player;
    player.take_damage(35);
    std::cout << "health after first hit: " << player.current() << '\n';

    player.take_damage(100);
    std::cout << "health after large hit: " << player.current() << '\n';

    return 0;
}
