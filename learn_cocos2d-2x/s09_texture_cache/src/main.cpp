#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/support/component/CCComponent.h"
#include "cocos2dx/textures/CCTextureCache.h"
#include <iostream>

using namespace cocos2d;

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
}
