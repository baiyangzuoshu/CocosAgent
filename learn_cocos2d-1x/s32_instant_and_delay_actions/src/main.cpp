#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionInstant.h"
#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/CCScheduler.h"

#include <iostream>

using namespace cocos2d;

int main() {
    CCScheduler scheduler;
    CCActionManager actionManager(&scheduler); // 1.x 的 ActionManager 初始化时注册到 Scheduler。
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

    scheduler.tick(0.0f); // 延迟动作的首帧只初始化计时。
    for (int frame = 1; frame <= 4; ++frame) {
        scheduler.tick(0.25f);
        std::cout << "frame " << frame << ": delay=" << delay.progress()
                  << ", active=" << actionManager.runningActionCount() << "\n";
    }
    return 0;
}
