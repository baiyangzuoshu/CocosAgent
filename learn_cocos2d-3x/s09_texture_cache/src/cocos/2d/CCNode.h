#pragma once

#include "CCComponentContainer.h"
#include "../base/CCScheduler.h"

namespace cocos2d {
class Component;

class Node {
public:
    explicit Node(Scheduler* scheduler) : _scheduler(scheduler), _components(this) {}
    void scheduleUpdate();
    bool addComponent(Component* component);
    bool removeComponent(Component* component);
    void onEnter();
    void onExit();
    void update(float delta);

private:
    Scheduler* _scheduler;
    ComponentContainer _components;
};
} // namespace cocos2d
