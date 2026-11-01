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

    pool.clear();

    printTree(scene);
    std::cout << "Player.parent = " << player->getParent()->getName() << '\n';

    scene->release();
    return 0;
}
