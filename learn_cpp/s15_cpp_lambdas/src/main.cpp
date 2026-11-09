#include <algorithm>
#include <iostream>
#include <vector>

int main()
{
    const std::vector<int> scores{42, 17, 35, 60};
    int threshold = 30;

    std::cout << "passing count (>= " << threshold << "): "
              << std::count_if(scores.cbegin(), scores.cend(),
                               [threshold](int score) {
                                   return score >= threshold;
                               })
              << '\n';

    int total = 0;
    std::for_each(scores.cbegin(), scores.cend(), [&total](int score) {
        total += score;
    });
    std::cout << "score total: " << total << '\n';

    return 0;
}
