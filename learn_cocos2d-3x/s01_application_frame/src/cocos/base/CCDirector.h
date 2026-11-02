#pragma once

#include "cocos/base/CCScheduler.h"

namespace cocos2d {

class Scene;

class Director {
public:
    Director();
    void runWithScene(Scene* scene);
    void mainLoop(float dt);

private:
    void drawScene();
    Scheduler _scheduler;
    Scene* _runningScene;
    float _deltaTime;
    unsigned int _frame;
};

} // namespace cocos2d
