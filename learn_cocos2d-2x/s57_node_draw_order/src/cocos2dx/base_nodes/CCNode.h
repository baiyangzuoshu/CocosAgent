#pragma once

#include <string>
#include <vector>

namespace cocos2d {
class CCNode {
public:
    explicit CCNode(const std::string& name, int zOrder = 0, bool visible = true);
    void addChild(CCNode* child, int zOrder);
    void visit();

private:
    void sortAllChildren();
    void draw() const;

    std::string _name;
    int _zOrder;
    unsigned int _orderOfArrival;
    bool _visible;
    bool _reorderChildDirty;
    std::vector<CCNode*> _children;
    static unsigned int s_orderOfArrival;
};
}
