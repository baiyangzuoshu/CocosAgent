#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCScene.h"
#include "cocos/physics/CCPhysicsBody.h"

#include <memory>

int main() {
    using namespace cocos2d;
    std::unique_ptr<Scene> scene(Scene::createWithPhysics());
    PhysicsWorld* world = scene->getPhysicsWorld();

    Node ground("ground", world);
    std::unique_ptr<PhysicsBody> groundBody(PhysicsBody::createBox({320, 32}, {0.1f, 0.0f, 0.6f}));
    groundBody->setDynamic(false);
    ground.setPhysicsBody(groundBody.get());

    Node crate("crate", world);
    std::unique_ptr<PhysicsBody> crateBody(PhysicsBody::createBox({40, 24}, {1.0f, 0.0f, 0.2f}));
    crate.setPhysicsBody(crateBody.get());
}
