#include "cocos/2d/CCScene.h"

#include <iostream>

using namespace cocos2d;

static void printTree(const Node* node, unsigned int depth = 0) {
    for (unsigned int i = 0; i < depth; ++i) {
        std::cout << "  ";
    }
    std::cout << node->getName() << '\n';

    for (const auto* child : node->getChildren()) {
        printTree(child, depth + 1);
    }
}

int main() {
    AutoreleasePool pool;

    auto* scene = Scene::create();
    scene->setName("MainScene");
    scene->retain(); // 模拟 Director 持有当前场景。

    auto* canvas = Node::create();
    canvas->setName("Canvas");
    scene->addChild(canvas);

    auto* player = Node::create();
    player->setName("Player");
    canvas->addChild(player);

    auto* weapon = Node::create();
    weapon->setName("Weapon");
    player->addChild(weapon);

    canvas->setPosition(100, 50);
    player->setPosition(12, 7);
    weapon->setPosition(2, 1);

    pool.clear();

    printTree(scene);
    std::cout << "Player.parent = " << player->getParent()->getName() << '\n';
    const auto& playerLocal = player->getPosition();
    const auto playerWorld = player->getWorldPosition();
    const auto weaponWorld = weapon->getWorldPosition();
    std::cout << "Player.local = (" << playerLocal.x << ", " << playerLocal.y << ")\n";
    std::cout << "Player.world = (" << playerWorld.x << ", " << playerWorld.y << ")\n";
    std::cout << "Weapon.world = (" << weaponWorld.x << ", " << weaponWorld.y << ")\n";

    scene->release();
    return 0;
}
