#include "cocos2dx/sprite_nodes/CCSpriteBatchNode.h"

int main() {
    CCSpriteBatchNode batch("ui.png");
    batch.addChild({"front", "ui.png", 1});
    batch.addChild({"back", "ui.png", -1});
    batch.visit();
}
