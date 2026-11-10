#include "resource/ResourceCopyPlan.h"

#include <iostream>

int main() {
    const lesson::ResourceCopyPlan plan = {
        "template/Resources",
        "build/bin/HelloCpp/Resources",
    };
    std::cout << "post-build: copy_if_different\n"
              << plan.sourceRoot << "/images/hero.png\n"
              << plan.destination("images/hero.png") << '\n';
}
