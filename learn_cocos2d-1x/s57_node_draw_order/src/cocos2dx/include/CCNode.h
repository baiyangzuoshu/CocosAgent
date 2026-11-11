#pragma once

#include <string>
#include <vector>

class CCNode {
public:
    explicit CCNode(const std::string& name, int zOrder = 0, bool visible = true);
    void addChild(CCNode* child, int zOrder);
    void visit() const;

private:
    void draw() const;

    std::string _name;
    int _zOrder;
    bool _visible;
    std::vector<CCNode*> _children;
};
