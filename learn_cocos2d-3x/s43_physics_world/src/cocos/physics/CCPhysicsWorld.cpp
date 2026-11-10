#include "cocos/physics/CCPhysicsWorld.h"

#include <iostream>

namespace cocos2d {

PhysicsWorld::PhysicsWorld()
: _fixedRate(0)
, _stepCount(0)
, _updateTime(0.0f)
, _autoStep(true) {
}

void PhysicsWorld::setFixedUpdateRate(int updatesPerSecond) {
    if (updatesPerSecond > 0) {
        _fixedRate = updatesPerSecond;
    }
}

void PhysicsWorld::update(float delta) {
    if (_fixedRate == 0) {
        step(delta);
        return;
    }

    _updateTime += delta;
    const float fixedStep = 1.0f / _fixedRate;
    while (_updateTime > fixedStep) {
        _updateTime -= fixedStep;
        step(fixedStep);
    }
}

void PhysicsWorld::step(float delta) {
    ++_stepCount;
    std::cout << "Chipmunk space step(dt=" << delta << ") #"
              << _stepCount << std::endl;
}

}
