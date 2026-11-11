#include "cocos2dx/base_nodes/CCNode.h"

int main() {
    cocos2d::CCNode scene("Scene");
    cocos2d::CCNode front("Front", 1);
    cocos2d::CCNode back("Back", -1);

    scene.addChild(&front, 1);
    scene.addChild(&back, -1);
    scene.visit();
}
