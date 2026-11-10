#pragma once

#include <cstdint>

class PhysicsShape {
public:
    void setCategoryBitmask(uint32_t value) { _categoryBitmask = value; }
    void setCollisionBitmask(uint32_t value) { _collisionBitmask = value; }
    void setContactTestBitmask(uint32_t value) { _contactTestBitmask = value; }
    void setGroup(int value) {
        _group = value;
        if (value < 0) _chipmunkGroup = value;
    }

    uint32_t getCategoryBitmask() const { return _categoryBitmask; }
    uint32_t getCollisionBitmask() const { return _collisionBitmask; }
    uint32_t getContactTestBitmask() const { return _contactTestBitmask; }
    int getGroup() const { return _group; }
    int getChipmunkGroup() const { return _chipmunkGroup; }

private:
    uint32_t _categoryBitmask = 0xFFFFFFFF;
    uint32_t _collisionBitmask = 0xFFFFFFFF;
    uint32_t _contactTestBitmask = 0;
    int _group = 0;
    int _chipmunkGroup = 0;
};

inline bool shouldNotify(const PhysicsShape& a, const PhysicsShape& b) {
    return (a.getCategoryBitmask() & b.getContactTestBitmask()) != 0
        && (a.getContactTestBitmask() & b.getCategoryBitmask()) != 0;
}

inline bool shouldRespond(const PhysicsShape& a, const PhysicsShape& b) {
    if (a.getGroup() != 0 && a.getGroup() == b.getGroup()) return a.getGroup() > 0;
    return (a.getCategoryBitmask() & b.getCollisionBitmask()) != 0
        && (b.getCategoryBitmask() & a.getCollisionBitmask()) != 0;
}

inline bool passesChipmunkGroupFilter(const PhysicsShape& a, const PhysicsShape& b) {
    return a.getChipmunkGroup() == 0 || a.getChipmunkGroup() != b.getChipmunkGroup();
}
