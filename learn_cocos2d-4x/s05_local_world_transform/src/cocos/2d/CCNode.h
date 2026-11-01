#pragma once

#include "cocos/base/CCRef.h"

#include <string>
#include <vector>

namespace cocos2d {

struct Vec2 {
    Vec2(float x = 0.0f, float y = 0.0f) : x(x), y(y) {}

    float x;
    float y;
};

class Node : public Ref {
public:
    static Node* create();

    void addChild(Node* child);
    void removeChild(Node* child);
    void setPosition(float x, float y);

    Node* getParent() const;
    const std::vector<Node*>& getChildren() const;
    const std::string& getName() const;
    const Vec2& getPosition() const;
    Vec2 getWorldPosition() const;
    void setName(const std::string& name);

protected:
    Node();
    ~Node() override;

private:
    void setParent(Node* parent);

    Node* _parent;
    std::vector<Node*> _children;
    std::string _name;
    Vec2 _position;
};

} // namespace cocos2d
