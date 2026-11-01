#pragma once

#include "cocos/base/CCRef.h"

#include <string>
#include <vector>

namespace cocos2d {

class Node : public Ref {
public:
    static Node* create();

    void addChild(Node* child);
    void removeChild(Node* child);

    Node* getParent() const;
    const std::vector<Node*>& getChildren() const;
    const std::string& getName() const;
    void setName(const std::string& name);

protected:
    Node();
    ~Node() override;

private:
    void setParent(Node* parent);

    Node* _parent;
    std::vector<Node*> _children;
    std::string _name;
};

} // namespace cocos2d
