#include <iostream>
#include <map>
#include <set>
#include <string>

int main()
{
    std::map<std::string, int> item_counts;
    item_counts["potion"] = 2;
    item_counts["key"] = 1;
    item_counts["potion"] += 1;
    item_counts["gem"] = 5;

    std::cout << "potion count: " << item_counts.at("potion") << '\n';
    std::cout << std::boolalpha;
    std::cout << "key exists: " << (item_counts.count("key") != 0) << '\n';
    std::cout << "inventory size: " << item_counts.size() << '\n';

    std::set<std::string> unlocked_areas{"Forest", "Harbor"};
    unlocked_areas.insert("Cave");
    unlocked_areas.insert("Forest");

    std::cout << "unlocked areas:";
    for (const std::string& area : unlocked_areas) {
        std::cout << ' ' << area;
    }
    std::cout << '\n';
    std::cout << "unique area count: " << unlocked_areas.size() << '\n';

    return 0;
}
