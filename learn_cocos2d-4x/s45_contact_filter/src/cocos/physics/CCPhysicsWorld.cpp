#include "CCPhysicsWorld.h"

#include <iostream>

void PhysicsWorld::step(PhysicsShape& a, PhysicsShape& b, const char* nameA, const char* nameB) {
    if (!passesChipmunkGroupFilter(a, b)) {
        std::cout << "Chipmunk group filter: " << nameA << " × " << nameB << '\n';
        return;
    }

    const bool notify = shouldNotify(a, b);
    bool respond = shouldRespond(a, b);
    PhysicsContact contact;

    if (notify) {
        contact.eventCode = PhysicsContact::EventCode::Begin;
        _listener.onEvent(contact);
        respond = respond && contact.result;
        if (respond) {
            contact.eventCode = PhysicsContact::EventCode::PreSolve;
            contact.result = true;
            _listener.onEvent(contact);
            respond = contact.result;
        }
    }

    if (respond) {
        std::cout << "碰撞响应: " << nameA << " × " << nameB << '\n';
        if (notify) {
            contact.eventCode = PhysicsContact::EventCode::PostSolve;
            _listener.onEvent(contact);
        }
    } else {
        std::cout << "本步不计算碰撞响应: " << nameA << " × " << nameB << '\n';
    }
}
