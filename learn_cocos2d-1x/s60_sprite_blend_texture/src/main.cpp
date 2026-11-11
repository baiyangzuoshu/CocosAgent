#include "cocos2dx/include/CCSprite.h"

int main() {
    GLState gl;
    CCSprite sprite(gl);
    sprite.setTexture("hero.png");
    sprite.setBlendFunc({"SRC_ALPHA", "ONE_MINUS_SRC_ALPHA"});
    sprite.draw();
}
