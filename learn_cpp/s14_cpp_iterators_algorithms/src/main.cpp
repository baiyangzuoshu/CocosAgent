#include <algorithm>
#include <iostream>
#include <vector>

void print_scores(const char* label, const std::vector<int>& scores)
{
    std::cout << label;
    for (std::vector<int>::const_iterator it = scores.cbegin();
         it != scores.cend();
         ++it) {
        std::cout << ' ' << *it;
    }
    std::cout << '\n';
}

int main()
{
    std::vector<int> scores{42, 17, 35, 17};
    print_scores("scores before sort:", scores);

    const std::vector<int>::const_iterator found =
        std::find(scores.cbegin(), scores.cend(), 35);
    if (found != scores.cend()) {
        std::cout << "found score: " << *found << '\n';
    }

    std::sort(scores.begin(), scores.end());
    print_scores("scores sorted:", scores);

    std::cout << "17 appears: "
              << std::count(scores.cbegin(), scores.cend(), 17) << '\n';

    return 0;
}
