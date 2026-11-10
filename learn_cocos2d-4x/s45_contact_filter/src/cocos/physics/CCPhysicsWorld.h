#pragma once

#include "CCPhysicsContact.h"
#include "CCPhysicsShape.h"

class PhysicsWorld {
public:
    explicit PhysicsWorld(EventListenerPhysicsContact& listener) : _listener(listener) {}
    void step(PhysicsShape& a, PhysicsShape& b, const char* nameA, const char* nameB);

private:
    EventListenerPhysicsContact& _listener;
};
