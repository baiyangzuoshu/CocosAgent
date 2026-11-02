#include "cocos2dx/include/CCScene.h"
#include "cocos2dx/include/CCAutoreleasePool.h"
#include <iostream>

using namespace cocos2d;

static void printTree(const CCNode* node, unsigned int depth = 0) {
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

int main() {
    CCAutoreleasePool pool;
    auto* scene = CCScene::node();
    scene->retain(); // 模拟 Director 持有当前场景。
    auto* canvas = CCNode::node();
    canvas->setTag(1);
    scene->addChild(canvas);
    auto* player = CCNode::node();
    player->setTag(2);
    canvas->addChild(player);
    auto* weapon = CCNode::node();
    weapon->setTag(3);
    player->addChild(weapon);

    pool.clear();
    printTree(scene);
    std::cout << "Player.parent = Node#" << player->getParent()->getTag() << "\n";

    scene->release();
    return 0;
}
