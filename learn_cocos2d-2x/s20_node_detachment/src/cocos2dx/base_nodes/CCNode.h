#pragma once

#include "../support/component/CCComponentContainer.h"
#include "../CCScheduler.h"
#include <string>
#include <utility>
#include <vector>

namespace cocos2d {
class CCComponent;

class CCNode {
public:
    explicit CCNode(CCScheduler* scheduler, std::string name = "Node")
        : _scheduler(scheduler), _components(this), _name(std::move(name)) {}
    virtual void onEnter();
    virtual void onExit();
    bool isRunning() const { return _running; }
    void scheduleUpdate();
    bool addComponent(CCComponent* component);
    bool removeComponent(CCComponent* component);
    void update(float delta);
    void addChild(CCNode* child, int zOrder = 0);
    void removeChild(CCNode* child, bool cleanup = true);
    CCNode* getParent() const { return _parent; }
    void setVisible(bool visible) { _visible = visible; }
    bool isVisible() const { return _visible; }
    void visit();
    virtual void draw() const {}
    const std::string& getName() const { return _name; }

private:
    CCScheduler* _scheduler;
    CCComponentContainer _components;
    std::string _name;
    int _zOrder = 0;
    bool _visible = true;
    bool _running = false;
    CCNode* _parent = nullptr;
    std::vector<CCNode*> _children;
};
} // namespace cocos2d
