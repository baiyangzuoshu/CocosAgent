#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCScene.h"

#include <iostream>

int main() {
    cocos2d::Scene scene(0);
    cocos2d::Node canvas(1);
    cocos2d::Node player(2);
    scene.addChild(&canvas);
    canvas.addChild(&player);

    std::cout << "-- enter --\n";
    scene.onEnter();
    std::cout << "-- exit --\n";
    scene.onExit();
    return 0;
}
