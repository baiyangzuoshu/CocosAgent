#include "cocos2dx/include/CCNode.h"
#include "cocos2dx/include/CCScheduler.h"
#include <iostream>

using namespace cocos2d;

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
}
