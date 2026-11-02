#pragma once

#include <vector>

namespace cocos2d {

class Node {
public:
    explicit Node(int tag = 0);
    virtual ~Node();
    void addChild(Node* child);
    virtual void onEnter();
    virtual void onExit();
    void setTag(int tag);
    int getTag() const;
    Node* getParent() const;
    const std::vector<Node*>& getChildren() const;

protected:
    void setParent(Node* parent);
    int _tag;
    bool _running;

private:
    Node* _parent;
    std::vector<Node*> _children;
};

} // namespace cocos2d
