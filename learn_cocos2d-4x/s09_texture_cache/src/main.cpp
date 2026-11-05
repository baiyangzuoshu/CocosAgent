#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCComponent.h"
#include "cocos/base/CCDirector.h"
#include <iostream>

using namespace cocos2d;

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
}
