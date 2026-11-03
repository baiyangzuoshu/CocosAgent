#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/CCScheduler.h"
#include <iostream>

using namespace cocos2d;

class Player : public CCNode {
public:
    void update(float delta) override {
        std::cout << "Player::update dt=" << delta << "\n";
    }
};

int main() {
    Player player;
    player.scheduleUpdate();
    CCScheduler::sharedScheduler().tick(1.0f / 60.0f);
}
