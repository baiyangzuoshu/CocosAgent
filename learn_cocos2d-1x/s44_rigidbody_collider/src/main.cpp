#include <iostream>
#include <memory>
#include <vector>

struct b2Vec2 {
    float x;
    float y;
    b2Vec2() : x(0), y(0) {}
    b2Vec2(float px, float py) : x(px), y(py) {}
};
enum b2BodyType { b2_staticBody, b2_kinematicBody, b2_dynamicBody };

struct b2BodyDef {
    b2BodyType type = b2_staticBody;
    b2Vec2 position;
};

class b2PolygonShape {
public:
    void SetAsBox(float halfWidth, float halfHeight) {
        _halfWidth = halfWidth;
        _halfHeight = halfHeight;
    }
    float _halfWidth = 0;
    float _halfHeight = 0;
};

struct b2FixtureDef {
    b2PolygonShape* shape = nullptr;
    float density = 0;
    float friction = 0.2f;
    float restitution = 0;
};

class b2Body {
public:
    explicit b2Body(const b2BodyDef& def) : _def(def) {}
    void CreateFixture(const b2FixtureDef* fixture) {
        std::cout << "  b2Body::CreateFixture box=" << fixture->shape->_halfWidth * 2
                  << "x" << fixture->shape->_halfHeight * 2 << "m, density="
                  << fixture->density << ", friction=" << fixture->friction
                  << ", restitution=" << fixture->restitution << "\n";
    }
    b2Vec2 GetPosition() const { return _def.position; }
private:
    b2BodyDef _def;
};

class b2World {
public:
    b2Body* CreateBody(const b2BodyDef* def) {
        _bodies.emplace_back(new b2Body(*def));
        std::cout << "b2World::CreateBody type=" << def->type
                  << " position=" << def->position.x << "," << def->position.y << "m\n";
        return _bodies.back().get();
    }
private:
    std::vector<std::unique_ptr<b2Body>> _bodies;
};

// 1.x 没有 Cocos PhysicsBody 包装；应用自己把节点与 Box2D body 对应起来。
class CCSprite {
public:
    explicit CCSprite(const char* name) : _name(name) {}
    void setPosition(float x, float y) { _x = x; _y = y; }
    void attachBox(b2World& world, b2BodyType type, float width, float height) {
        const float ptmRatio = 32.0f;
        b2BodyDef bodyDef;
        bodyDef.type = type;
        bodyDef.position = b2Vec2(_x / ptmRatio, _y / ptmRatio);
        _body = world.CreateBody(&bodyDef);

        b2PolygonShape shape;
        shape.SetAsBox(width / 2 / ptmRatio, height / 2 / ptmRatio);
        b2FixtureDef fixtureDef;
        fixtureDef.shape = &shape;
        fixtureDef.density = type == b2_dynamicBody ? 1.0f : 0.0f;
        fixtureDef.friction = 0.4f;
        _body->CreateFixture(&fixtureDef);
        std::cout << "CCSprite " << _name << " 保存 body 指针（应用层映射）\n";
    }
private:
    const char* _name;
    float _x = 0;
    float _y = 0;
    b2Body* _body = nullptr;
};

int main() {
    b2World world;
    CCSprite ground("ground");
    ground.setPosition(160, 32);
    ground.attachBox(world, b2_staticBody, 320, 32);

    CCSprite crate("crate");
    crate.setPosition(160, 120);
    crate.attachBox(world, b2_dynamicBody, 40, 24);
}
