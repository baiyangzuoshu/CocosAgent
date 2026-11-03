#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCActionInterval.h"
#include "cocos/2d/CCActionManager.h"
#include "cocos/base/CCScheduler.h"

#include <iostream>

using namespace cocos2d;

int main() {
    Scheduler scheduler;
    ActionManager actionManager;
    scheduler.scheduleUpdateForTarget(&actionManager); // 2.x 起由 Director 注册 ActionManager。
    Node player(&actionManager);
    MoveBy moveBy(2.0f, 4.0f);
    player.runAction(&moveBy);

    scheduler.update(0.0f); // 首帧初始化时间动作。
    for (int frame = 1; frame <= 4; ++frame) {
        scheduler.update(0.5f);
        std::cout << "frame " << frame << ": x=" << player.getPositionX() << "\n";
    }
    return 0;
}
