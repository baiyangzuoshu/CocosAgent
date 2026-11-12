#include "PhysicsStudy.h"
namespace cocos2d { void runLesson() { Physics3DWorldStudy world; Physics3DComponentStudy body("Crate"); body.onEnter(world); world.step(); body.syncPhysicsToNode(4.25f); body.onExit(world); std::cout << "registered after onExit = " << world.bodies.count("Crate") << "\n"; } }
