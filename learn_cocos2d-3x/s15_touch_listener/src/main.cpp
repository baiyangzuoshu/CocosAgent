#include "cocos/platform/CCGLView.h"
#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCSprite.h"
#include "cocos/2d/CCSpriteFrame.h"
#include "cocos/2d/CCScene.h"
#include "cocos/2d/CCComponent.h"
#include "cocos/base/CCDirector.h"
#include "cocos/renderer/CCRenderer.h"
#include <iostream>

using namespace cocos2d;

class DrawNode : public Node {
public:
    using Node::Node;
    void draw(Renderer& renderer) const override { renderer.addCommand(getName(), getGlobalZOrder()); }
};

class PlayerLogic : public Component {
public:
    void onAdd() override { std::cout << "onAdd\n"; }
    void onEnter() override { std::cout << "onEnter\n"; }
    void update(float delta) override { std::cout << "component update dt=" << delta << "\n"; }
    void onExit() override { std::cout << "onExit\n"; }
    void onRemove() override { std::cout << "onRemove\n"; }
};

int main() {
    Scheduler scheduler;
    Node player(&scheduler);
    PlayerLogic logic;
    player.addComponent(&logic); // addComponent 内部调用 scheduleUpdate。
    player.onEnter();
    scheduler.update(1.0f / 60.0f);
    player.onExit();
    player.removeComponent(&logic);

    auto* cache = Director::getInstance()->getTextureCache();
    auto* first = cache->addImage("hero.png");
    auto* second = cache->addImage("hero.png");
    std::cout << "same texture: " << std::boolalpha << (first == second) << "\n";
    SpriteFrame playerFrame(first, {0, 0, 64, 64});

    Scene scene(&scheduler, "MainScene");
    DrawNode background(&scheduler, "Background"), ui(&scheduler, "UI");
    Sprite playerNode(&scheduler, "Player");
    playerNode.setSpriteFrame(&playerFrame);
    background.setGlobalZOrder(0);
    playerNode.setGlobalZOrder(10);
    ui.setGlobalZOrder(-1);
    scene.addChild(&playerNode, 0);
    scene.addChild(&ui, 1);
    scene.addChild(&background, -1);
    Director::getInstance()->runWithScene(&scene);
    Director::getInstance()->drawScene();
    EventDispatcher dispatcher;
    EventListenerTouchOneByOne listener;
    listener.onTouchBegan = [&playerNode](const Touch& touch) {
        const bool hit = touch.x >= 40 && touch.x <= 60 && touch.y >= 20 && touch.y <= 40;
        std::cout << playerNode.getName() << (hit ? " hit\n" : " miss\n");
        return hit;
    };
    dispatcher.addEventListener(&listener);
    GLView view(dispatcher);
    view.handleTouchesBegin(7, 110, 80);
    view.handleTouchesBegin(8, 210, 180);

}
