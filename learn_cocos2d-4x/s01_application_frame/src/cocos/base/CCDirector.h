#pragma once

#include "cocos/base/CCScheduler.h"

#include <memory>

namespace cocos2d {

class Scene;

class Director {
public:
    ~Director();

    static Director* getInstance();
    void runWithScene(Scene* scene);
    void mainLoop();

private:
    Director();
    void drawScene();

    Scheduler _scheduler;
    std::unique_ptr<Scene> _runningScene;
    unsigned int _frame;
};

} // namespace cocos2d
