#include "cocos/2d/CCScene.h"
#include "cocos/base/CCAutoreleasePool.h"
#include <iostream>

using namespace cocos2d;

static void printTree(const Node* node, unsigned int depth = 0) {
    for (unsigned int i = 0; i < depth; ++i) {
        std::cout << "  ";
    }
    if (!node->getParent()) {
        std::cout << "Scene\n";
    } else {
        std::cout << "Node#" << node->getTag() << "\n";
    }
    for (const auto* child : node->getChildren()) {
        printTree(child, depth + 1);
    }
}

static Vec2 worldPosition(const Node* node) {
    float x = node->getPosition().x;
    float y = node->getPosition().y;
    for (auto* parent = node->getParent(); parent; parent = parent->getParent()) {
        x += parent->getPosition().x;
        y += parent->getPosition().y;
    }
    return Vec2(x, y);
}
int main() {
    AutoreleasePool pool;
    auto* scene = Scene::create();
    scene->retain(); // 模拟 Director 持有当前场景。
    auto* canvas = Node::create();
    canvas->setTag(1);
    scene->addChild(canvas);
    auto* player = Node::create();
    player->setTag(2);
    canvas->addChild(player);
    auto* weapon = Node::create();
    weapon->setTag(3);
    player->addChild(weapon);

    canvas->setPosition(100.0f, 50.0f);
    player->setPosition(12.0f, 7.0f);
    weapon->setPosition(2.0f, 1.0f);

    pool.clear();
    printTree(scene);
    std::cout << "Player.parent = Node#" << player->getParent()->getTag() << "\n";
    const auto& local = player->getPosition();
    std::cout << "Player.local = (" << local.x << ", " << local.y << ")\n";
    auto playerWorld = worldPosition(player);
    auto weaponWorld = worldPosition(weapon);
    std::cout << "Player.world = (" << playerWorld.x << ", " << playerWorld.y << ")\n";
    std::cout << "Weapon.world = (" << weaponWorld.x << ", " << weaponWorld.y << ")\n";

    scene->release();
    return 0;
}
