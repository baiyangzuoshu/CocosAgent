#include "score.hpp"

#include <iostream>
#include <vector>

int main()
{
    const std::vector<Score> scores{
        {"Ada", 80, 10},
        {"Lin", 95, 0},
    };

    for (const Score& score : scores) {
        std::cout << score.name << ": " << score.total() << '\n';
    }

    return 0;
}
