#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCActionInstant.h"
#include "cocos/2d/CCActionInterval.h"
#include "cocos/2d/CCActionManager.h"
#include "cocos/base/CCScheduler.h"

#include <iostream>

using namespace cocos2d;

int main() {
    Scheduler scheduler;
    ActionManager actionManager;
    scheduler.scheduleUpdateForTarget(&actionManager); // 2.x 起由 Director 注册 ActionManager。
    Node node(&actionManager);
    bool callbackFired = false;
    CallFunc call([&callbackFired]() {
        callbackFired = true;
        std::cout << "CallFunc callback\n";
    });
    DelayTime delay(1.0f);

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
