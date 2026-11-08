#pragma once

#include <string>
#include <utility>
#include <vector>

namespace cocos2d {
class CCNode;
using SEL_SCHEDULE = void (CCNode::*)(float);

class CCNode {
public:
    explicit CCNode(std::string name = "Node") : _name(std::move(name)) {}
    virtual ~CCNode() = default;
    virtual void onEnter();
    bool isRunning() const { return _running; }
    void schedule(SEL_SCHEDULE selector, float interval);
    virtual void onTimer(float elapsed);
    void addChild(CCNode* child, int zOrder = 0);
    void setVisible(bool visible) { _visible = visible; }
    bool isVisible() const { return _visible; }
    void visit();
    virtual void draw() const {}
    const std::string& getName() const { return _name; }

private:
    std::string _name;
    int _zOrder = 0;
    bool _visible = true;
    bool _running = false;
    std::vector<CCNode*> _children;
};
} // namespace cocos2d
