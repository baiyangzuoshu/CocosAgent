#include "cocos2dx/CCDirector.h"
#include "cocos2dx/include/CCScene.h"

#include <iostream>

int main() {
    cocos2d::CCDirector* director = cocos2d::CCDirector::sharedDirector();
    cocos2d::CCScene* scene = cocos2d::CCScene::node();
    director->runWithScene(scene);

    for (int frame = 1; frame <= 3; ++frame) {
        std::cout << "platform frame " << frame << '\n';
        director->drawScene();
    }
    return 0;
}
