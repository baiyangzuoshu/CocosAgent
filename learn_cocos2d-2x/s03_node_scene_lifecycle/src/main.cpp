#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/layers_scenes_transitions_nodes/CCScene.h"

#include <iostream>

int main() {
    cocos2d::CCScene scene(0);
    cocos2d::CCNode canvas(1);
    cocos2d::CCNode player(2);
    scene.addChild(&canvas);
    canvas.addChild(&player);

    std::cout << "-- enter --\n";
    scene.onEnter();
    std::cout << "-- exit --\n";
    scene.onExit();
    return 0;
}
