#include <iostream>

class Health {
public:
    Health()
        : current_{100}
    {
    }

    explicit Health(int initial)
        : current_{initial < 0 ? 0 : (initial > 100 ? 100 : initial)}
    {
    }

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
    int current_;
};

int main()
{
    Health default_health;
    Health player{80};
    Health high_input{120};
    Health low_input{-10};

    player.take_damage(15);

    std::cout << "default health: " << default_health.current() << '\n';
    std::cout << "player after hit: " << player.current() << '\n';
    std::cout << "high input clamped: " << high_input.current() << '\n';
    std::cout << "low input clamped: " << low_input.current() << '\n';

    return 0;
}
