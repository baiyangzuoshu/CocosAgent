#include "cocos2dx/base_nodes/CCNode.h"
#include "game/NodePool.h"
#include <cstddef>
#include <iostream>

using namespace cocos2d;

class EnemyNode : public CCNode {
public:
    using CCNode::CCNode;
    int hp = 60;
    bool visualEffectActive = true;
};

class EnemyPoolHandler : public PoolHandler {
public:
    void unuse(CCNode* node) override {
        auto* enemy = static_cast<EnemyNode*>(node);
        enemy->hp = 0;
        enemy->visualEffectActive = false;
        std::cout << "unuse: hp=0, visualEffect=false\n";
    }

    void reuse(CCNode* node, int hp) override {
        auto* enemy = static_cast<EnemyNode*>(node);
        enemy->hp = hp;
        enemy->visualEffectActive = true;
        std::cout << "reuse(" << hp << "): visualEffect=true\n";
    }
};

int main() {
    auto* scene = new CCNode("MainScene");
    scene->onEnter();
    auto* enemy = new EnemyNode("EnemyA");
    scene->addChild(enemy);
    EnemyNode* identity = enemy;
    EnemyPoolHandler handler;
    NodePool pool(&handler);

    std::cout << "before put: hp=" << enemy->hp
              << "; visualEffect=" << std::boolalpha << enemy->visualEffectActive << "\n";
    pool.put(enemy); // onExit, then unuse, then the pool stores the node
    enemy->release(); // transfer the creator's reference to the pool
    std::cout << "after put: size=" << pool.size()
              << "; parent is null=" << (identity->getParent() == nullptr)
              << "; hp=" << identity->hp << "\n";

    auto* reused = static_cast<EnemyNode*>(pool.get(45)); // reuse runs before this return
    scene->addChild(reused);
    std::cout << "after get: same node=" << (reused == identity)
              << "; hp=" << reused->hp
              << "; visualEffect=" << reused->visualEffectActive
              << "; size=" << pool.size() << "\n";

    pool.put(reused);
    reused->release();
    pool.clear();

    auto* pooledMiss = pool.get(45);
    if (!pooledMiss) {
        std::cout << "pool miss: get returned null; create EnemyFallback\n";
        auto* fallback = new EnemyNode("EnemyFallback");
        scene->addChild(fallback);
        std::cout << "fallback initial hp=" << fallback->hp
                  << "; visualEffect=" << fallback->visualEffectActive
                  << "; reuse was not called\n";
        scene->removeChild(fallback, false);
        fallback->release();
    }
    const std::size_t poolCapacity = 1;
    auto* capacitySeed = new EnemyNode("CapacitySeed");
    scene->addChild(capacitySeed);
    if (pool.size() < poolCapacity) {
        pool.put(capacitySeed);
        capacitySeed->release(); // the pool now owns the remaining reference
    }
    std::cout << "capacity filled: " << pool.size() << "/" << poolCapacity << "\n";

    auto* overflowCandidate = new EnemyNode("OverflowCandidate");
    scene->addChild(overflowCandidate);
    if (pool.size() < poolCapacity) {
        pool.put(overflowCandidate);
        overflowCandidate->release();
        std::cout << "candidate stored; size=" << pool.size() << "\n";
    } else {
        std::cout << "pool full: remove and release OverflowCandidate\n";
        scene->removeChild(overflowCandidate, false);
        overflowCandidate->release(); // release the creator's reference
    }
    pool.clear();
    scene->release();
}
