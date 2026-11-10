#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionEase.h"
#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/CCScheduler.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

class ProgressAction : public CCActionInterval {
public:
    ProgressAction(float duration, float* value)
        : CCActionInterval(duration), _value(value) {
    }

    void update(float progress) override {
        *_value = progress;
    }

private:
    float* _value;
};

int main() {
    CCScheduler scheduler;
    CCActionManager actionManager;
    scheduler.scheduleUpdateForTarget(&actionManager);
    CCNode node(&actionManager);

    float linear = 0.0f;
    float eased = 0.0f;
    float repeated = 0.0f;
    float reversed = 1.0f;

    ProgressAction linearAction(1.2f, &linear);
    ProgressAction easeInner(1.2f, &eased);
    CCEaseIn easeAction(&easeInner, 2.0f);
    ProgressAction repeatInner(0.4f, &repeated);
    CCRepeat repeatAction(&repeatInner, 3);
    ProgressAction reverseInner(1.2f, &reversed);
    CCReverseTime reverseAction(&reverseInner);

    node.runAction(&linearAction);
    node.runAction(&easeAction);
    node.runAction(&repeatAction);
    node.runAction(&reverseAction);

    scheduler.update(0.0f);
    std::cout << std::fixed << std::setprecision(2);
    for (int frame = 0; frame <= 4; ++frame) {
        if (frame > 0) scheduler.update(0.30f);
        std::cout << "t=" << frame * 0.30f
                  << " linear=" << linear
                  << " easeIn=" << eased
                  << " repeat=" << repeatAction.currentIteration() << "/3:" << repeated
                  << " reverse=" << reversed
                  << " active=" << actionManager.runningActionCount() << "\n";
    }
    return 0;
}
