#include "cocos/base/CCScheduler.h"

#include <iomanip>
#include <iostream>

namespace cocos2d {

void Scheduler::update(float dt) {
    std::cout << "Scheduler.update dt=" << std::fixed << std::setprecision(3) << dt << '\n';
}

} // namespace cocos2d
