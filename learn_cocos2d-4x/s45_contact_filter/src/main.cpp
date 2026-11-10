#include "cocos/physics/CCPhysicsWorld.h"

#include <iostream>

int main() {
    EventListenerPhysicsContact listener;
    listener.onContactBegin = [](PhysicsContact&) {
        std::cout << "onContactBegin\n";
        return true;
    };
    listener.onContactPreSolve = [](PhysicsContact&) {
        std::cout << "onContactPreSolve: 返回 false\n";
        return false; // 保留接触通知，但跳过本步 Chipmunk 响应。
    };
    listener.onContactPostSolve = [](PhysicsContact&) {
        std::cout << "onContactPostSolve\n";
    };

    PhysicsShape player;
    player.setCategoryBitmask(0x1);
    player.setContactTestBitmask(0x2);
    player.setCollisionBitmask(0x2);
    PhysicsShape wall;
    wall.setCategoryBitmask(0x2);
    wall.setContactTestBitmask(0x1);
    wall.setCollisionBitmask(0x1);

    PhysicsShape quietA;
    quietA.setCategoryBitmask(0x4);
    quietA.setCollisionBitmask(0x8);
    PhysicsShape quietB;
    quietB.setCategoryBitmask(0x8);
    quietB.setCollisionBitmask(0x4);

    PhysicsShape forcedA;
    forcedA.setCategoryBitmask(0x1);
    forcedA.setCollisionBitmask(0);
    forcedA.setGroup(5);
    PhysicsShape forcedB;
    forcedB.setCategoryBitmask(0x2);
    forcedB.setCollisionBitmask(0);
    forcedB.setGroup(5);

    PhysicsShape ignoredA;
    ignoredA.setGroup(-3);
    PhysicsShape ignoredB;
    ignoredB.setGroup(-3);

    PhysicsWorld world(listener);
    world.step(player, wall, "player", "wall");
    world.step(quietA, quietB, "quiet-A", "quiet-B");
    world.step(forcedA, forcedB, "forced-A", "forced-B");
    world.step(ignoredA, ignoredB, "ignored-A", "ignored-B");
}
