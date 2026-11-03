#pragma once

#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCActionManager;

class CCScheduler {
public:
    void scheduleUpdateForTarget(CCActionManager* target);
    void tick(ccTime dt);

private:
    CCActionManager* _target = nullptr;
};

} // namespace cocos2d
