#pragma once

#include "CCPhysicsShape.h"

#include <functional>
#include <utility>
#include <vector>

class PhysicsWorld;

struct PhysicsRayCastInfo {
    PhysicsShape* shape;
    float fraction;
};

using PhysicsRayCastCallbackFunc = std::function<bool(PhysicsWorld&, const PhysicsRayCastInfo&, void*)>;
using PhysicsQueryRectCallbackFunc = std::function<bool(PhysicsWorld&, PhysicsShape&, void*)>;

class PhysicsWorld {
public:
    enum { DEBUGDRAW_NONE = 0x00, DEBUGDRAW_SHAPE = 0x01, DEBUGDRAW_JOINT = 0x02, DEBUGDRAW_CONTACT = 0x04 };

    explicit PhysicsWorld(std::vector<PhysicsShape> shapes) : _shapes(std::move(shapes)) {}
    void rayCast(PhysicsRayCastCallbackFunc callback, void* data);
    void queryRect(PhysicsQueryRectCallbackFunc callback, const PhysicsRect& rect, void* data);
    void setDebugDrawMask(int mask) { _debugDrawMask = mask; }
    void update();

private:
    void debugDraw();
    std::vector<PhysicsShape> _shapes;
    int _debugDrawMask = DEBUGDRAW_NONE;
};
