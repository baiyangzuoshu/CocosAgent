#pragma once

#include "../base/CCRef.h"
#include <string>
#include <vector>

namespace cocos2d {
class Node : public Ref {
public:
    explicit Node(std::string name);
    ~Node() override;
    void addChild(Node* child);
    void removeChild(Node* child, bool cleanup = true);
    void cleanup();
    void onEnter();
    void onExit();
    Node* getParent() const { return _parent; }

private:
    std::string _name;
    Node* _parent = nullptr;
    bool _running = false;
    std::vector<Node*> _children;
};
} // namespace cocos2d
