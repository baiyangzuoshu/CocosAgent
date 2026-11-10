#pragma once

#include <functional>

class PhysicsContact {
public:
    enum class EventCode { Begin, PreSolve, PostSolve, Separate };
    EventCode eventCode = EventCode::Begin;
    bool result = true;
};

class EventListenerPhysicsContact {
public:
    std::function<bool(PhysicsContact&)> onContactBegin;
    std::function<bool(PhysicsContact&)> onContactPreSolve;
    std::function<void(PhysicsContact&)> onContactPostSolve;
    std::function<void(PhysicsContact&)> onContactSeparate;

    void onEvent(PhysicsContact& contact) {
        switch (contact.eventCode) {
        case PhysicsContact::EventCode::Begin:
            if (onContactBegin) contact.result = onContactBegin(contact);
            break;
        case PhysicsContact::EventCode::PreSolve:
            if (onContactPreSolve) contact.result = onContactPreSolve(contact);
            break;
        case PhysicsContact::EventCode::PostSolve:
            if (onContactPostSolve) onContactPostSolve(contact);
            break;
        case PhysicsContact::EventCode::Separate:
            if (onContactSeparate) onContactSeparate(contact);
            break;
        }
    }
};
