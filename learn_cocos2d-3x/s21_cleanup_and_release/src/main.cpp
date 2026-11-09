#include "cocos/2d/CCNode.h"
#include <iostream>

using namespace cocos2d;

int main() {
    auto* scene = new Node("MainScene");
    scene->onEnter();

    std::cout << "\nEnemyA: parent is the only owner\n";
    auto* enemyA = new Node("EnemyA");
    scene->addChild(enemyA);
    std::cout << "after addChild retainCount=" << enemyA->retainCount() << "\n";
    enemyA->release(); // release the creator's reference; the parent still owns it
    scene->removeChild(enemyA, true); // cleanup, then parent's release reaches zero

    std::cout << "\nEnemyB: creator keeps one reference\n";
    auto* enemyB = new Node("EnemyB");
    scene->addChild(enemyB);
    scene->removeChild(enemyB, true);
    std::cout << "after removeChild retainCount=" << enemyB->retainCount()
              << "; parent is null=" << std::boolalpha << (enemyB->getParent() == nullptr) << "\n";
    enemyB->release(); // the final owner decides when the object is destroyed
    scene->release();
}
