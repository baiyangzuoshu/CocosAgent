#include <algorithm>
#include <iostream>
#include <utility>
#include <vector>

struct b2AABB {
    float minX, minY, maxX, maxY;
    bool Overlaps(const b2AABB& other) const {
        return minX <= other.maxX && maxX >= other.minX
            && minY <= other.maxY && maxY >= other.minY;
    }
};

struct b2Fixture {
    const char* name;
    b2AABB bounds;
    float hitFraction;
    bool startsInside;
};

class b2QueryCallback {
public:
    virtual ~b2QueryCallback() = default;
    virtual bool ReportFixture(const b2Fixture* fixture) = 0;
};

class b2RayCastCallback {
public:
    virtual ~b2RayCastCallback() = default;
    virtual float ReportFixture(const b2Fixture* fixture, float fraction) = 0;
};

class b2Draw {
public:
    enum { e_shapeBit = 0x01, e_jointBit = 0x02, e_aabbBit = 0x04 };
    void SetFlags(unsigned flags) { _flags = flags; }
    unsigned GetFlags() const { return _flags; }
    virtual ~b2Draw() = default;
    virtual void DrawFixture(const b2Fixture& fixture) = 0;
private:
    unsigned _flags = 0;
};

class b2World {
public:
    explicit b2World(std::vector<b2Fixture> fixtures) : _fixtures(std::move(fixtures)) {}
    void QueryAABB(b2QueryCallback* callback, const b2AABB& area) const {
        for (const auto& fixture : _fixtures) {
            if (fixture.bounds.Overlaps(area) && !callback->ReportFixture(&fixture)) break;
        }
    }
    void RayCast(b2RayCastCallback* callback, float start, float end) const {
        (void)start;
        (void)end;
        std::vector<const b2Fixture*> ordered;
        for (const auto& fixture : _fixtures) if (!fixture.startsInside) ordered.push_back(&fixture);
        std::sort(ordered.begin(), ordered.end(), [](const b2Fixture* a, const b2Fixture* b) {
            return a->hitFraction < b->hitFraction;
        });
        float maxFraction = 1.0f;
        for (const auto* fixture : ordered) {
            if (fixture->hitFraction > maxFraction) continue;
            const float result = callback->ReportFixture(fixture, fixture->hitFraction);
            if (result == 0.0f) break;
            if (result > 0.0f) maxFraction = result;
        }
    }
    void SetDebugDraw(b2Draw* draw) { _debugDraw = draw; }
    void DrawDebugData() const {
        if (!_debugDraw || _debugDraw->GetFlags() == 0) return;
        for (const auto& fixture : _fixtures) _debugDraw->DrawFixture(fixture);
    }
private:
    std::vector<b2Fixture> _fixtures;
    b2Draw* _debugDraw = nullptr; // Box2D keeps a non-owning pointer.
};

class AllFixtures : public b2QueryCallback {
public:
    bool ReportFixture(const b2Fixture* fixture) override {
        std::cout << "QueryAABB: " << fixture->name << '\n';
        return true;
    }
};

class ClosestHit : public b2RayCastCallback {
public:
    float ReportFixture(const b2Fixture* fixture, float fraction) override {
        std::cout << "RayCast: " << fixture->name << " fraction=" << fraction << '\n';
        return fraction;
    }
};

class DebugDraw : public b2Draw {
public:
    void DrawFixture(const b2Fixture& fixture) override {
        if (GetFlags() & e_shapeBit) std::cout << "DrawDebugData: " << fixture.name << " shape\n";
        if (GetFlags() & e_aabbBit) std::cout << "DrawDebugData: " << fixture.name << " AABB\n";
    }
};

int main() {
    b2World world({
        {"near-crate", {20, 10, 35, 30}, 0.25f, false},
        {"far-wall", {55, 10, 70, 30}, 0.65f, false},
        {"start-inside", {-5, 10, 5, 30}, 0.0f, true},
    });
    AllFixtures query;
    world.QueryAABB(&query, {15, 5, 40, 35});
    ClosestHit ray;
    world.RayCast(&ray, 0.0f, 100.0f);
    DebugDraw draw;
    draw.SetFlags(b2Draw::e_shapeBit | b2Draw::e_aabbBit);
    world.SetDebugDraw(&draw);
    world.DrawDebugData();
}
