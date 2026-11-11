#include "CCDirector.h"

#include "base_nodes/CCNode.h"
#include <iostream>

CCDirector::CCDirector(CCNode* runningScene) : _runningScene(runningScene) {}

void CCDirector::drawScene() {
    std::cout << "CCDirector::drawScene -> clear\n";
    if (_runningScene) _runningScene->visit();
    std::cout << "CCDirector::drawScene -> swapBuffers\n";
}
