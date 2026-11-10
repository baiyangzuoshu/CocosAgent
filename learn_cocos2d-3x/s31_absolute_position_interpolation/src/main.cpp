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
    Node left(&actionManager);
    Node right(&actionManager);
    left.setPositionX(2.0f);
    right.setPositionX(-4.0f);
    MoveTo moveLeft(2.0f, 10.0f);
    MoveTo moveRight(2.0f, 10.0f);
    left.runAction(&moveLeft);
    right.runAction(&moveRight);

    scheduler.update(0.0f); // 首帧初始化时间动作。
    for (int frame = 1; frame <= 4; ++frame) {
        scheduler.update(0.5f);
        std::cout << "frame " << frame << ": left=" << left.getPositionX()
                  << ", right=" << right.getPositionX() << "\n";
    }
    return 0;
}
