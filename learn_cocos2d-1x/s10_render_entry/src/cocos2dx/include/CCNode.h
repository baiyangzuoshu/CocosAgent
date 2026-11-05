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
    void schedule(SEL_SCHEDULE selector, float interval);
    virtual void onTimer(float elapsed);
    void addChild(CCNode* child, int zOrder = 0);
    void visit();
    virtual void draw() const {}
    const std::string& getName() const { return _name; }

private:
    std::string _name;
    int _zOrder = 0;
    std::vector<CCNode*> _children;
};
} // namespace cocos2d
