#include <cstdint>
#include <iostream>

// 1.x 示例直接使用仓库附带的 Box2D；这里裁出过滤与回调所需接口。
struct b2Filter {
    uint16_t categoryBits;
    uint16_t maskBits;
    int16_t groupIndex;
    b2Filter(uint16_t category = 0x0001, uint16_t mask = 0xFFFF, int16_t group = 0)
        : categoryBits(category), maskBits(mask), groupIndex(group) {}
};

struct b2Fixture {
    const char* name;
    b2Filter filter;
    b2Fixture(const char* fixtureName, b2Filter fixtureFilter)
        : name(fixtureName), filter(fixtureFilter) {}
};

class b2Contact {
public:
    explicit b2Contact(b2Fixture& a, b2Fixture& b) : fixtureA(a), fixtureB(b) {}
    void SetEnabled(bool value) { enabled = value; }
    b2Fixture& fixtureA;
    b2Fixture& fixtureB;
    bool enabled = true;
};

class b2ContactFilter {
public:
    bool ShouldCollide(const b2Fixture& a, const b2Fixture& b) const {
        const auto& filterA = a.filter;
        const auto& filterB = b.filter;
        if (filterA.groupIndex == filterB.groupIndex && filterA.groupIndex != 0) {
            return filterA.groupIndex > 0;
        }
        return (filterA.maskBits & filterB.categoryBits) != 0
            && (filterA.categoryBits & filterB.maskBits) != 0;
    }
};

class b2ContactListener {
public:
    virtual ~b2ContactListener() = default;
    virtual void BeginContact(b2Contact*) {}
    virtual void PreSolve(b2Contact*) {}
    virtual void PostSolve(b2Contact*) {}
    virtual void EndContact(b2Contact*) {}
};

class GameContactListener : public b2ContactListener {
public:
    void BeginContact(b2Contact* contact) override {
        std::cout << "BeginContact: " << contact->fixtureA.name << " + " << contact->fixtureB.name << '\n';
    }
    void PreSolve(b2Contact* contact) override {
        std::cout << "PreSolve: 临时关闭本步响应\n";
        contact->SetEnabled(false);
    }
    void PostSolve(b2Contact*) override {
        std::cout << "PostSolve: 读取本步冲量\n";
    }
    void EndContact(b2Contact*) override {
        std::cout << "EndContact\n";
    }
};

class b2World {
public:
    void SetContactListener(b2ContactListener* listener) { _listener = listener; }

    void Step(b2Fixture& a, b2Fixture& b) {
        b2ContactFilter filter;
        if (!filter.ShouldCollide(a, b)) {
            std::cout << "过滤: " << a.name << " × " << b.name << '\n';
            return;
        }
        b2Contact contact(a, b);
        _listener->BeginContact(&contact);
        _listener->PreSolve(&contact);
        if (contact.enabled) _listener->PostSolve(&contact);
        else std::cout << "求解器跳过本步响应\n";
    }

private:
    b2ContactListener* _listener = nullptr; // World 不拥有 listener。
};

int main() {
    b2World world;
    GameContactListener listener;
    world.SetContactListener(&listener);

    b2Fixture player{"player", {0x0001, 0x0000, 4}};
    b2Fixture wall{"wall", {0x0002, 0x0000, 4}};
    b2Fixture ghostA{"ghost-A", {0x0001, 0xFFFF, -2}};
    b2Fixture ghostB{"ghost-B", {0x0002, 0xFFFF, -2}};
    world.Step(player, wall);  // 相同正 group 优先于 mask：仍创建接触。
    world.Step(ghostA, ghostB); // 相同负 group：过滤，不进入回调。
}
