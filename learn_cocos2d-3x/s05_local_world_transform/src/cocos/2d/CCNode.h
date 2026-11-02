#pragma once

#include "cocos/base/CCRef.h"
#include "cocos/math/CCGeometry.h"

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
    void setTag(int tag);
    int getTag() const;
    void setPosition(float x, float y);
    void setPosition(const Vec2& position);
    const Vec2& getPosition() const;


protected:
    Node();
    ~Node() override;

private:
    void setParent(Node* parent);
    Node* _parent;
    std::vector<Node*> _children;
    int _tag;
    Vec2 _position;

};

} // namespace cocos2d
