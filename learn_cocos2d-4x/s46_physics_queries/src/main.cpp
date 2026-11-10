#include "cocos/physics/CCPhysicsWorld.h"

#include <iostream>
#include <vector>

int main() {
    PhysicsWorld world({
        {"near-crate", {20, 10, 35, 30}, 0.25f, false},
        {"far-wall", {55, 10, 70, 30}, 0.65f, false},
        {"start-inside", {-5, 10, 5, 30}, 0.0f, true},
    });

    world.rayCast([](PhysicsWorld&, const PhysicsRayCastInfo& info, void*) {
        std::cout << "rayCast: " << info.shape->name << " fraction=" << info.fraction << '\n';
        return true; // true 继续；false 停止。
    }, nullptr);
    world.queryRect([](PhysicsWorld&, PhysicsShape& shape, void*) {
        std::cout << "queryRect: " << shape.name << '\n';
        return true;
    }, {15, 5, 40, 35}, nullptr);
    world.setDebugDrawMask(PhysicsWorld::DEBUGDRAW_SHAPE | PhysicsWorld::DEBUGDRAW_CONTACT);
    world.update();
}
