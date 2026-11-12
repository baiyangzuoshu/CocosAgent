#pragma once

#include "cocos2dx/CCScheduler.h"

#include <memory>

namespace cocos2d {

class CCScene;

class CCDirector {
public:
    ~CCDirector();

    static CCDirector* sharedDirector();

    void runWithScene(CCScene* scene);
    void drawScene();

private:
    CCDirector();

    CCScheduler _scheduler;
    std::unique_ptr<CCScene> _runningScene;
    unsigned int _frame;
};

} // namespace cocos2d
