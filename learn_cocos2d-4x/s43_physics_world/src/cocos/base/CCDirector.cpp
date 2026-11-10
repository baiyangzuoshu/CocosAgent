#include "cocos/base/CCDirector.h"
#include "cocos/2d/CCScene.h"

#include <iostream>

namespace cocos2d {

void Director::mainLoop(float deltaTime) {
    std::cout << "Director: Scheduler.update(dt=" << deltaTime << ")"
              << std::endl;
    std::cout << "Director: AFTER_UPDATE" << std::endl;
    std::cout << "Director: stepPhysicsAndNavigation before draw"
              << std::endl;
    if (_runningScene) {
        _runningScene->stepPhysicsAndNavigation(deltaTime);
    }
    std::cout << "Director: render scene" << std::endl;
}

}
