#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionInstant.h"
#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/CCScheduler.h"

#include <iostream>

using namespace cocos2d;

int main() {
    CCScheduler scheduler;
    CCActionManager actionManager;
    scheduler.scheduleUpdateForTarget(&actionManager); // 2.x 起由 Director 注册 ActionManager。
    CCNode node(&actionManager);
    bool callbackFired = false;
    CCCallFunc call([&callbackFired]() {
        callbackFired = true;
        std::cout << "CallFunc callback\n";
    });
    CCDelayTime delay(1.0f);

    std::cout << "before runAction\n";
    node.runAction(&call);
    std::cout << "after runAction: callback=" << (callbackFired ? "yes" : "no") << "\n";
    node.runAction(&delay);

    scheduler.update(0.0f); // 首次 Scheduler 更新执行 CallFunc 并初始化 DelayTime。
    std::cout << "after first update: callback=" << (callbackFired ? "yes" : "no") << "\n";
    for (int frame = 1; frame <= 4; ++frame) {
        scheduler.update(0.25f);
        std::cout << "frame " << frame << ": delay=" << delay.progress()
                  << ", active=" << actionManager.runningActionCount() << "\n";
    }
    return 0;
}
