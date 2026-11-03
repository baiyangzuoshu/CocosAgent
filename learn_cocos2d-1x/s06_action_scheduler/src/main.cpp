#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/CCScheduler.h"

#include <iostream>

using namespace cocos2d;

int main() {
    CCScheduler scheduler;
    CCActionManager actionManager(&scheduler); // 1.x 的 ActionManager 初始化时注册到 Scheduler。
    CCNode player(&actionManager);
    CCMoveBy moveBy(2.0f, 4.0f);
    player.runAction(&moveBy);

    scheduler.tick(0.0f); // 首帧初始化时间动作。
    for (int frame = 1; frame <= 4; ++frame) {
        scheduler.tick(0.5f);
        std::cout << "frame " << frame << ": x=" << player.getPositionX() << "\n";
    }
    return 0;
}
