#include "cocos2dx/include/CCNode.h"
#include "game/NodePool.h"
#include <iostream>

using namespace cocos2d;

int main() {
    auto* scene = new CCNode("MainScene");
    scene->onEnter();
    auto* enemy = new CCNode("EnemyA");
    scene->addChild(enemy);
    CCNode* identity = enemy;
    NodePool pool;

    std::cout << "after addChild retainCount=" << enemy->retainCount() << "\n";
    pool.put(enemy);
    enemy->release(); // transfer the creator's reference to the pool
    std::cout << "after put: size=" << pool.size()
              << "; parent is null=" << std::boolalpha << (identity->getParent() == nullptr)
              << "; retainCount=" << identity->retainCount() << "\n";

    auto* reused = pool.get();
    scene->addChild(reused);
    std::cout << "after get: same node=" << (reused == identity)
              << "; size=" << pool.size() << "\n";

    pool.put(reused);
    reused->release(); // the pool is the remaining owner
    std::cout << "clear the pool; the final release destroys the node\n";
    pool.clear();
    scene->release();
}
