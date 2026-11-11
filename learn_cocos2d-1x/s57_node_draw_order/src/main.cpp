#include "cocos2dx/include/CCNode.h"

int main() {
    CCNode scene("Scene");
    CCNode front("Front", 1);
    CCNode back("Back", -1);

    scene.addChild(&front, 1);
    scene.addChild(&back, -1);
    scene.visit();
}
