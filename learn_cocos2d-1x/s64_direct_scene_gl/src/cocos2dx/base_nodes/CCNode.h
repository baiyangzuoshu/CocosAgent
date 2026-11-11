#pragma once

#include <string>
#include <vector>

class CCNode {
public:
    explicit CCNode(std::string name);
    virtual ~CCNode() = default;
    void addChild(CCNode* child);
    virtual void draw();
    void visit();

protected:
    std::string _name;
    std::vector<CCNode*> _children;
};
