#include "cocos/base/CCDirector.h"
#include "cocos/2d/CCScene.h"

#include <iostream>

int main() {
    cocos2d::Scene scene;
    cocos2d::Director director;
    director.runWithScene(&scene);

    for (int frame = 1; frame <= 3; ++frame) {
        std::cout << "platform frame " << frame << '\n';
        director.mainLoop(1.0f / 60.0f);
    }
    return 0;
}
