#include "cocos2dx/CCDirector.h"
#include "cocos2dx/layers_scenes_transitions_nodes/CCScene.h"

#include <iostream>

int main() {
    cocos2d::CCScene scene;
    cocos2d::CCDirector director;
    director.runWithScene(&scene);

    for (int frame = 1; frame <= 3; ++frame) {
        std::cout << "platform frame " << frame << '\n';
        director.drawScene();
    }
    return 0;
}
