#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/CCScheduler.h"

#include <iostream>

using namespace cocos2d;

int main() {
    CCScheduler scheduler;
    CCActionManager actionManager(&scheduler); // 1.x 的 ActionManager 初始化时注册到 Scheduler。
    CCNode left(&actionManager);
    CCNode right(&actionManager);
    left.setPositionX(2.0f);
    right.setPositionX(-4.0f);
    CCMoveTo moveLeft(2.0f, 10.0f);
    CCMoveTo moveRight(2.0f, 10.0f);
    left.runAction(&moveLeft);
    right.runAction(&moveRight);

    scheduler.tick(0.0f); // 首帧初始化时间动作。
    for (int frame = 1; frame <= 4; ++frame) {
        scheduler.tick(0.5f);
        std::cout << "frame " << frame << ": left=" << left.getPositionX()
                  << ", right=" << right.getPositionX() << "\n";
    }
    return 0;
}
