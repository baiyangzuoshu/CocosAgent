#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionInstant.h"
#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/CCScheduler.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

int main() {
    CCScheduler scheduler;
    CCActionManager actionManager(&scheduler);

    CCNode node(&actionManager);

    CCDelayTime shortDelay(0.25f);
    CCDelayTime longDelay(0.50f);
    CCCallFunc shortDone([]() { std::cout << "event: short branch done\n"; });
    CCCallFunc longDone([]() { std::cout << "event: long branch done\n"; });
    CCCallFunc afterParallel([]() { std::cout << "event: outer sequence continues\n"; });
    CCSequence shortBranch(&shortDelay, &shortDone);
    CCSequence longBranch(&longDelay, &longDone);
    CCSpawn parallel(&shortBranch, &longBranch);
    CCSequence action(&parallel, &afterParallel);

    node.runAction(&action);
    scheduler.tick(0.0f);
    std::cout << std::fixed << std::setprecision(2)
              << "time=0.00 progress=" << action.progress()
              << " active=" << actionManager.runningActionCount() << "\n";
    for (int frame = 1; frame <= 2; ++frame) {
        scheduler.tick(0.25f);
        std::cout << "time=" << frame * 0.25f << " progress=" << action.progress()
                  << " active=" << actionManager.runningActionCount() << "\n";
    }
    return 0;
}
