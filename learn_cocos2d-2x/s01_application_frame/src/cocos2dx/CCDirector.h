#pragma once

#include "cocos2dx/CCScheduler.h"

namespace cocos2d {

class CCScene;

class CCDirector {
public:
    CCDirector();
    void runWithScene(CCScene* scene);
    void drawScene();

private:
    CCScheduler _scheduler;
    CCScene* _runningScene;
    unsigned int _frame;
};

} // namespace cocos2d
