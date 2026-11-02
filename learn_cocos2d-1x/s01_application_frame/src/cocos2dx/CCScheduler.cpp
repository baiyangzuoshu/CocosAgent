#include "cocos2dx/CCScheduler.h"

#include <iomanip>
#include <iostream>

namespace cocos2d {

void CCScheduler::tick(float dt) {
    std::cout << "CCScheduler.tick dt=" << std::fixed << std::setprecision(3) << dt << '\n';
}

} // namespace cocos2d
