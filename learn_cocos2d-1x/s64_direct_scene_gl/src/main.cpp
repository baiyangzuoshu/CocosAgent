#include "cocos2dx/CCDirector.h"
#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/sprite_nodes/CCSprite.h"

int main() {
    CCNode scene("running-scene");
    CCSprite sprite("hero", 7);
    scene.addChild(&sprite);

    CCDirector director(&scene);
    director.drawScene();
}
