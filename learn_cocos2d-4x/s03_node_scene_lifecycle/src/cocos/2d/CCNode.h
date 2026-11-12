#pragma once

#include <string>
#include <vector>

namespace cocos2d {

class Node {
public:
    explicit Node(const std::string& name);
    virtual ~Node();

    void addChild(Node* child);
    virtual void onEnter();
    virtual void onExit();

    const std::string& getName() const;
    Node* getParent() const;
    bool isRunning() const;

protected:
    void setParent(Node* parent);

private:
    std::string _name;
    bool _running;
    Node* _parent;
    std::vector<Node*> _children;
};

} // namespace cocos2d
