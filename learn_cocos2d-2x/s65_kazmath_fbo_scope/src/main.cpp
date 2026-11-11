#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/misc_nodes/CCRenderTexture.h"

#include <iostream>

int main() {
    CCRenderTexture target(10, "offscreen-color", 320, 180);
    CCNode scene("running-scene");

    target.beginWithClear();
    scene.visit();
    target.end();

    std::cout << "CCSprite samples " << target.getSpriteTexture() << "\n";
}
