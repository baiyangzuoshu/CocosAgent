#include "CCPhysicsWorld.h"

#include <algorithm>
#include <iostream>

void PhysicsWorld::rayCast(PhysicsRayCastCallbackFunc callback, void* data) {
    std::vector<PhysicsShape*> ordered;
    for (auto& shape : _shapes) if (!shape.startsInside) ordered.push_back(&shape);
    std::sort(ordered.begin(), ordered.end(), [](const PhysicsShape* a, const PhysicsShape* b) {
        return a->fraction < b->fraction;
    });
    for (auto* shape : ordered) {
        PhysicsRayCastInfo info{shape, shape->fraction};
        if (!callback(*this, info, data)) break;
    }
}

void PhysicsWorld::queryRect(PhysicsQueryRectCallbackFunc callback, const PhysicsRect& rect, void* data) {
    for (auto& shape : _shapes) {
        if (shape.bounds.overlaps(rect) && !callback(*this, shape, data)) break;
    }
}

void PhysicsWorld::debugDraw() {
    if (_debugDrawMask & DEBUGDRAW_SHAPE) {
        for (const auto& shape : _shapes) std::cout << "DrawNode: " << shape.name << " shape\n";
    }
    if (_debugDrawMask & DEBUGDRAW_CONTACT) std::cout << "DrawNode: contact markers\n";
}

void PhysicsWorld::update() {
    if (_debugDrawMask != DEBUGDRAW_NONE) debugDraw();
}
