#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/support/component/CCComponent.h"
#include <iostream>

using namespace cocos2d;

class PlayerLogic : public CCComponent {
public:
    void onEnter() override { std::cout << "onEnter (attached)\n"; }
    void update(float delta) override { std::cout << "update dt=" << delta << "\n"; }
    void onExit() override { std::cout << "onExit (removed)\n"; }
};

int main() {
    CCNode player;
    PlayerLogic logic;
    player.addComponent(&logic);
    player.update(1.0f / 60.0f);
    player.removeComponent(&logic);
}
