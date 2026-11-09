#include <cstddef>
#include <iostream>
#include <vector>

void add_bonus(int* score)
{
    if (score == nullptr) {
        return;
    }

    ++*score;
}

void print_scores(const int* values, std::size_t count)
{
    std::cout << "scores:";
    for (std::size_t index = 0; index < count; ++index) {
        std::cout << ' ' << values[index];
    }
    std::cout << '\n';
}

int main()
{
    std::vector<int> scores{10, 20, 30};
    int* first_score = scores.data();

    add_bonus(first_score);
    std::cout << "first after borrowed update: " << scores.front() << '\n';

    scores.reserve(scores.capacity() + 1);
    first_score = scores.data();
    add_bonus(first_score);

    print_scores(scores.data(), scores.size());
    return 0;
}
