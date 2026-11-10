#pragma once

struct PhysicsRect {
    float minX, minY, maxX, maxY;
    bool overlaps(const PhysicsRect& other) const {
        return minX <= other.maxX && maxX >= other.minX
            && minY <= other.maxY && maxY >= other.minY;
    }
};

struct PhysicsShape {
    const char* name;
    PhysicsRect bounds;
    float fraction;
    bool startsInside;
};
