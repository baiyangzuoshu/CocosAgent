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

class ActorRoot : public DrawNode {
public:
    using DrawNode::DrawNode;
    void onEnter() override {
        std::cout << getName() << " Node::onEnter (attached to active scene)\n";
        DrawNode::onEnter();
    }
    void onExit() override {
        std::cout << getName() << " Node::onExit (leaving active scene)\n";
        DrawNode::onExit();
    }
};

class ActorLogic : public Component {
public:
    void onAdd() override { std::cout << "ActorLogic::onAdd (component created)\n"; }
    void onEnter() override { std::cout << "ActorLogic::onEnter (node entered scene)\n"; }
    void onExit() override { std::cout << "ActorLogic::onExit (node left scene)\n"; }
};

struct ActorTree {
    ActorRoot root;
    Sprite body;
    DrawNode marker;
    ActorLogic logic;

    ActorTree(Scheduler* scheduler, SpriteFrame* frame, const std::string& name)
        : root(scheduler, name), body(scheduler, "Body"), marker(scheduler, "Marker") {
        body.setSpriteFrame(frame);
        root.addChild(&body);
        body.addChild(&marker);
        root.addComponent(&logic);
    }
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
    std::cout << "ActorTrees constructed; attaching to the active Scene\n";
    ActorTree enemyA(&scheduler, &playerFrame, "EnemyA"), enemyB(&scheduler, &playerFrame, "EnemyB");
    scene.addChild(&enemyA.root, 3);
    scene.addChild(&enemyB.root, 4);
    std::cout << "Remove EnemyA (cleanup=false)\n";
    scene.removeChild(&enemyA.root, false);
    std::cout << "EnemyA detached, subtree running flags cleared: " << std::boolalpha
              << (enemyA.root.getParent() == nullptr && !enemyA.root.isRunning()
                  && !enemyA.body.isRunning() && !enemyA.marker.isRunning()) << "\n";
    std::cout << "Reattach EnemyA\n";
    scene.addChild(&enemyA.root, 3);
    std::cout << "EnemyA reattached, subtree running flags set: " << std::boolalpha
              << (enemyA.root.getParent() == &scene && enemyA.root.isRunning()
                  && enemyA.body.isRunning() && enemyA.marker.isRunning()) << "\n";
    std::cout << "independent Sprite nodes: " << std::boolalpha << (&enemyA.body != &enemyB.body)
              << "; shared SpriteFrame: " << (enemyA.body.getSpriteFrame() == enemyB.body.getSpriteFrame()) << "\n";
    Director::getInstance()->drawScene();
    auto demonstrate = [](bool swallow, bool hit) {
        std::cout << "scenario swallow=" << std::boolalpha << swallow << " hit=" << hit << "\n";
        EventDispatcher dispatcher;
        EventListenerTouchOneByOne higher, lower;
        higher.onTouchBegan = [](const Touch& touch) {
            const bool inside = touch.x >= 40 && touch.x <= 60 && touch.y >= 20 && touch.y <= 40;
            std::cout << "higher listener claimed=" << std::boolalpha << inside << "\n";
            return inside;
        };
        higher.setSwallowTouches(swallow);
        lower.onTouchBegan = [](const Touch&) { std::cout << "lower listener\n"; return true; };
        dispatcher.addEventListener(&lower, 10);
        dispatcher.addEventListener(&higher, -10);
        GLView view(dispatcher);
        view.handleTouchesBegin(7, hit ? 110 : 210, hit ? 80 : 180);
    };
    demonstrate(true, true);
    demonstrate(false, true);
    demonstrate(true, false);

}
