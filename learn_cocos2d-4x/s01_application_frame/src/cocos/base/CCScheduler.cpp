#include "cocos/base/CCScheduler.h"

#include <iostream>

namespace cocos2d {

void Scheduler::update(float dt) {
    std::cout << "Scheduler.update dt=" << dt << '\n';
}

} // namespace cocos2d
