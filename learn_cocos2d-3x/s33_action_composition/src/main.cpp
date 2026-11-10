#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCActionInstant.h"
#include "cocos/2d/CCActionInterval.h"
#include "cocos/2d/CCActionManager.h"
#include "cocos/base/CCScheduler.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

int main() {
    Scheduler scheduler;
    ActionManager actionManager;
    scheduler.scheduleUpdateForTarget(&actionManager);

    Node node(&actionManager);

    DelayTime shortDelay(0.25f);
    DelayTime longDelay(0.50f);
    CallFunc shortDone([]() { std::cout << "event: short branch done\n"; });
    CallFunc longDone([]() { std::cout << "event: long branch done\n"; });
    CallFunc afterParallel([]() { std::cout << "event: outer sequence continues\n"; });
    Sequence shortBranch(&shortDelay, &shortDone);
    Sequence longBranch(&longDelay, &longDone);
    Spawn parallel(&shortBranch, &longBranch);
    Sequence action(&parallel, &afterParallel);

    node.runAction(&action);
    scheduler.update(0.0f);
    std::cout << std::fixed << std::setprecision(2)
              << "time=0.00 progress=" << action.progress()
              << " active=" << actionManager.runningActionCount() << "\n";
    for (int frame = 1; frame <= 2; ++frame) {
        scheduler.update(0.25f);
        std::cout << "time=" << frame * 0.25f << " progress=" << action.progress()
                  << " active=" << actionManager.runningActionCount() << "\n";
    }
    return 0;
}
