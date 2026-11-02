#include "cocos2dx/CCScheduler.h"

#include <iomanip>
#include <iostream>

namespace cocos2d {

void CCScheduler::update(float dt) {
    std::cout << "CCScheduler.update dt=" << std::fixed << std::setprecision(3) << dt << '\n';
}

} // namespace cocos2d
