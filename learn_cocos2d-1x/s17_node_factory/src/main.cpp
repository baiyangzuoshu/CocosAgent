#include "cocos2dx/touch_dispatcher/CCTouchDispatcher.h"
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

struct ActorTree {
    DrawNode root;
    DrawNode body;
    DrawNode marker;

    explicit ActorTree(const std::string& name)
        : root(name), body("Body"), marker("Marker") {
        root.addChild(&body);
        body.addChild(&marker);
    }
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
    ActorTree enemyA("EnemyA"), enemyB("EnemyB");
    scene.addChild(&enemyA.root, 3);
    scene.addChild(&enemyB.root, 4);
    std::cout << "independent factory trees: " << std::boolalpha
              << (&enemyA.root != &enemyB.root && &enemyA.body != &enemyB.body) << "\n";
    CCDirector::sharedDirector().runWithScene(&scene);
    CCDirector::sharedDirector().drawScene();
    auto demonstrate = [&](bool swallow, bool hit) {
        std::cout << "scenario swallow=" << std::boolalpha << swallow << " hit=" << hit << "\n";
        CCTouchDispatcher dispatcher;
        dispatcher.addTargetedDelegate([](const CCTouch&) { std::cout << "lower listener\n"; return true; }, 10, false);
        dispatcher.addTargetedDelegate([](const CCTouch& touch) {
            const bool inside = touch.x >= 40 && touch.x <= 60 && touch.y >= 20 && touch.y <= 40;
            std::cout << "higher listener claimed=" << std::boolalpha << inside << "\n";
            return inside;
        }, -10, swallow);
        CCEGLView view;
        view.touchesBegan = [&dispatcher](const CCTouch& touch) { dispatcher.touchesBegan(touch); };
        view.mouseDown(hit ? 110 : 210, hit ? 80 : 180);
    };
    demonstrate(true, true);
    demonstrate(false, true);
    demonstrate(true, false);

}
