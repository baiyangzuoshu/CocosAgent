#pragma once

#include "CCComponentContainer.h"
#include "../base/CCScheduler.h"
#include <string>
#include <utility>
#include <vector>

namespace cocos2d { class Renderer; }

namespace cocos2d {
class Component;

class Node {
public:
    explicit Node(Scheduler* scheduler, std::string name = "Node")
        : _scheduler(scheduler), _components(this), _name(std::move(name)) {}
    void scheduleUpdate();
    bool addComponent(Component* component);
    bool removeComponent(Component* component);
    virtual void onEnter();
    void onExit();
    void update(float delta);
    void addChild(Node* child, int zOrder = 0);
    void setGlobalZOrder(float order) { _globalZOrder = order; }
    float getGlobalZOrder() const { return _globalZOrder; }
    void visit(Renderer& renderer);
    virtual void draw(Renderer& renderer) const {}
    const std::string& getName() const { return _name; }

private:
    Scheduler* _scheduler;
    ComponentContainer _components;
    std::string _name;
    int _zOrder = 0;
    float _globalZOrder = 0;
    bool _running = false;
    std::vector<Node*> _children;
};
} // namespace cocos2d
