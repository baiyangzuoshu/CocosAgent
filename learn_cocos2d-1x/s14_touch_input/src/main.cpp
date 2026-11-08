#include "cocos2dx/platform/win32/CCEGLView_win32.h"
#include "cocos2dx/include/CCNode.h"
#include "cocos2dx/include/CCSprite.h"
#include "cocos2dx/include/CCDirector.h"
#include "cocos2dx/include/CCScene.h"
#include "cocos2dx/include/CCScheduler.h"
#include "cocos2dx/textures/CCTextureCache.h"
#include "cocos2dx/include/CCSpriteFrame.h"
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
    CCSpriteFrame playerFrame(first, {0, 0, 64, 64});

    CCScene scene("MainScene");
    DrawNode background("Background"), ui("UI");
    CCSprite playerNode("Player");
    playerNode.setDisplayFrame(&playerFrame);
    CCNode hiddenGroup("HiddenGroup");
    DrawNode hiddenChild("HiddenChild");
    hiddenGroup.addChild(&hiddenChild);
    hiddenGroup.setVisible(false);
    scene.addChild(&playerNode, 0);
    scene.addChild(&hiddenGroup, 1);
    scene.addChild(&ui, 2);
    scene.addChild(&background, -1);
    CCDirector::sharedDirector().runWithScene(&scene);
    CCDirector::sharedDirector().drawScene();
    CCEGLView view;
    view.touchesBegan = [](const CCTouch& touch) { std::cout << "touch began view=(" << touch.x << "," << touch.y << ")\n"; };
    view.mouseDown(110, 80);

}
