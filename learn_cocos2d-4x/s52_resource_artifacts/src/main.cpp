#include "resource/ResourceSyncPlan.h"

#include <iostream>

int main() {
    const lesson::ResourceSyncPlan plan = {
        "SYNC_RESOURCE-HelloCpp",
        "template/Resources",
        "<target resource directory>",
    };
    std::cout << "target=" << plan.target << '\n'
              << plan.syncCommand("images/hero.png") << '\n';
}
