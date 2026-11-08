#include "cocos2dx/touch_dispatcher/CCTouchDispatcher.h"
#include "cocos2dx/platform/CCEGLViewProtocol.h"
#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/sprite_nodes/CCSprite.h"
#include "cocos2dx/layers_scenes_transitions_nodes/CCScene.h"
#include "cocos2dx/CCDirector.h"
#include "cocos2dx/support/component/CCComponent.h"
#include "cocos2dx/textures/CCTextureCache.h"
#include "cocos2dx/sprite_nodes/CCSpriteFrame.h"
#include <iostream>

using namespace cocos2d;

class DrawNode : public CCNode {
public:
    using CCNode::CCNode;
    void draw() const override { std::cout << "draw " << getName() << "\n"; }
};

struct ActorTree {
    DrawNode root;
    CCSprite body;
    DrawNode marker;

    ActorTree(CCScheduler* scheduler, const CCSpriteFrame* frame, const std::string& name)
        : root(scheduler, name), body(scheduler, "Body"), marker(scheduler, "Marker") {
        body.setDisplayFrame(frame);
        root.addChild(&body);
        body.addChild(&marker);
    }
};

class PlayerLogic : public CCComponent {
public:
    void onEnter() override { std::cout << "onEnter (attached)\n"; }
    void update(float delta) override { std::cout << "component update dt=" << delta << "\n"; }
    void onExit() override { std::cout << "onExit (removed)\n"; }
};

int main() {
    CCScheduler scheduler;
    CCNode player(&scheduler);
    PlayerLogic logic;
    player.addComponent(&logic);
    player.scheduleUpdate(); // 2.x addComponent 不自动注册 Node 更新。
    scheduler.update(1.0f / 60.0f);
    player.removeComponent(&logic);

    auto* cache = CCTextureCache::sharedTextureCache();
    auto* first = cache->addImage("hero.png");
    auto* second = cache->addImage("hero.png");
    std::cout << "same texture: " << std::boolalpha << (first == second) << "\n";
    CCSpriteFrame playerFrame(first, {0, 0, 64, 64});

    CCScene scene(&scheduler, "MainScene");
    DrawNode background(nullptr, "Background"), ui(nullptr, "UI");
    CCSprite playerNode(nullptr, "Player");
    playerNode.setDisplayFrame(&playerFrame);
    CCNode hiddenGroup(nullptr, "HiddenGroup");
    DrawNode hiddenChild(nullptr, "HiddenChild");
    hiddenGroup.addChild(&hiddenChild);
    hiddenGroup.setVisible(false);
    scene.addChild(&playerNode, 0);
    scene.addChild(&hiddenGroup, 1);
    scene.addChild(&ui, 2);
    scene.addChild(&background, -1);
    ActorTree enemyA(&scheduler, &playerFrame, "EnemyA"), enemyB(&scheduler, &playerFrame, "EnemyB");
    scene.addChild(&enemyA.root, 3);
    scene.addChild(&enemyB.root, 4);
    std::cout << "independent Sprite nodes: " << std::boolalpha << (&enemyA.body != &enemyB.body)
              << "; shared texture: " << (enemyA.body.getTexture() == enemyB.body.getTexture()) << "\n";
    CCDirector::sharedDirector()->runWithScene(&scene);
    CCDirector::sharedDirector()->drawScene();
    auto demonstrate = [&](bool swallow, bool hit) {
        std::cout << "scenario swallow=" << std::boolalpha << swallow << " hit=" << hit << "\n";
        CCTouchDispatcher dispatcher;
        dispatcher.addTargetedDelegate([](const CCTouch&) { std::cout << "lower listener\n"; return true; }, 10, false);
        dispatcher.addTargetedDelegate([](const CCTouch& touch) {
            const bool inside = touch.x >= 40 && touch.x <= 60 && touch.y >= 20 && touch.y <= 40;
            std::cout << "higher listener claimed=" << std::boolalpha << inside << "\n";
            return inside;
        }, -10, swallow);
        CCEGLViewProtocol view;
        view.touchesBegan = [&dispatcher](const CCTouch& touch) { dispatcher.touchesBegan(touch); };
        view.handleTouchesBegin(7, hit ? 110 : 210, hit ? 80 : 180);
    };
    demonstrate(true, true);
    demonstrate(false, true);
    demonstrate(true, false);

}
