#include <iostream>
#include <string>
#include <vector>

class Position {
public:
    Position(int x, int y)
        : x_{x}, y_{y}
    {
    }

    void move_by(int dx, int dy)
    {
        x_ += dx;
        y_ += dy;
    }

    int x() const
    {
        return x_;
    }

    int y() const
    {
        return y_;
    }

private:
    int x_;
    int y_;
};

class Inventory {
public:
    void add(const char* item)
    {
        items_.emplace_back(item);
    }

    void print() const
    {
        std::cout << "inventory:";
        for (const std::string& item : items_) {
            std::cout << ' ' << item;
        }
        std::cout << '\n';
    }

private:
    std::vector<std::string> items_;
};

class Character {
public:
    Character(int x, int y)
        : position_{x, y}
    {
    }

    void move_by(int dx, int dy)
    {
        position_.move_by(dx, dy);
    }

    void collect(const char* item)
    {
        inventory_.add(item);
    }

    void print() const
    {
        std::cout << "position: (" << position_.x() << ", " << position_.y() << ")\n";
        inventory_.print();
    }

private:
    Position position_;
    Inventory inventory_;
};

int main()
{
    Character hero{2, 3};
    hero.move_by(1, -1);
    hero.collect("key");
    hero.collect("potion");
    hero.print();
    return 0;
}
