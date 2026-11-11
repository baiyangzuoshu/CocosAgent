#include "cocos2dx/sprite_nodes/CCSprite.h"

int main() {
    CCSprite sprite;
    sprite.setTextureRect(64, 32);
    sprite.updateColor({255, 180, 90, 128});
    sprite.draw();
}
