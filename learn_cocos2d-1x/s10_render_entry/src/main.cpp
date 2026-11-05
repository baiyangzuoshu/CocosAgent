#include "cocos2dx/include/CCNode.h"
#include "cocos2dx/include/CCDirector.h"
#include "cocos2dx/include/CCScene.h"
#include "cocos2dx/include/CCScheduler.h"
#include "cocos2dx/textures/CCTextureCache.h"
#include <iostream>

using namespace cocos2d;

class DrawNode : public CCNode {
public:
    using CCNode::CCNode;
    void draw() const override { std::cout << "draw " << getName() << "\n"; }
};

class Player : public CCNode {
public:
    void onTimer(float elapsed) override {
        std::cout << "timer callback elapsed=" << elapsed << "\n";
    }
};

int main() {
    Player player;
    player.schedule(&CCNode::onTimer, 0.5f);
    for (int frame = 0; frame < 6; ++frame) {
        CCScheduler::sharedScheduler().tick(0.25f);
    }

    auto* cache = CCTextureCache::sharedTextureCache();
    auto* first = cache->addImage("hero-HD.png");
    auto* second = cache->addImage("hero.png");
    std::cout << "same texture: " << std::boolalpha << (first == second) << "\n";

    CCScene scene("MainScene");
    DrawNode background("Background"), playerNode("Player"), ui("UI");
    scene.addChild(&playerNode, 0);
    scene.addChild(&ui, 1);
    scene.addChild(&background, -1);
    CCDirector::sharedDirector().runWithScene(&scene);
    CCDirector::sharedDirector().drawScene();
}
