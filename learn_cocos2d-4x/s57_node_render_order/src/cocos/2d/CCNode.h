#pragma once

#include <string>
#include <vector>

namespace cocos2d {
class Camera;
class Renderer;

class Node {
public:
    Node(std::string name, int localZOrder = 0, bool visible = true,
         unsigned short cameraMask = 1, float globalZOrder = 0);
    void addChild(Node* child);
    void visit(const Camera& camera, Renderer& renderer);

private:
    void sortAllChildren();

    std::string _name;
    int _localZOrder;
    bool _visible;
    unsigned short _cameraMask;
    float _globalZOrder;
    unsigned int _orderOfArrival = 0;
    bool _childrenDirty = false;
    std::vector<Node*> _children;
    static unsigned int s_nextArrival;
};
}
