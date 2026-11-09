#include <array>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

int main()
{
    std::string scene_name{"Forest"};
    scene_name += " stage";

    std::array<int, 3> base_scores{12, 18, 15};
    std::vector<int> bonus_scores{5, 7};
    bonus_scores.push_back(3);

    std::cout << "scene: " << scene_name << '\n';

    std::cout << "base scores:";
    for (std::size_t i = 0; i < base_scores.size(); ++i) {
        std::cout << ' ' << base_scores[i];
    }
    std::cout << '\n';

    std::cout << "bonus scores:";
    for (std::size_t i = 0; i < bonus_scores.size(); ++i) {
        std::cout << ' ' << bonus_scores[i];
    }
    std::cout << '\n';
    std::cout << "bonus count: " << bonus_scores.size() << '\n';

    return 0;
}
