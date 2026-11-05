#pragma once

#include "../support/component/CCComponentContainer.h"
#include "../CCScheduler.h"

namespace cocos2d {
class CCComponent;

class CCNode {
public:
    explicit CCNode(CCScheduler* scheduler) : _scheduler(scheduler), _components(this) {}
    void scheduleUpdate();
    bool addComponent(CCComponent* component);
    bool removeComponent(CCComponent* component);
    void update(float delta);

private:
    CCScheduler* _scheduler;
    CCComponentContainer _components;
};
} // namespace cocos2d
