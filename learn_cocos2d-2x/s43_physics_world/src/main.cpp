#include <iomanip>
#include <iostream>

class DemoBox2DWorld {
public:
    DemoBox2DWorld() : _stepCount(0) {}

    void Step(float timeStep, int velocityIterations, int positionIterations) {
        ++_stepCount;
        std::cout << "Box2D Step(" << std::fixed << std::setprecision(4)
                  << timeStep << ", " << velocityIterations << ", "
                  << positionIterations << ") #" << _stepCount << std::endl;
    }

private:
    int _stepCount;
};

class CCNode {
public:
    CCNode() : _scheduled(false) {}
    virtual ~CCNode() {}

    void scheduleUpdate() { _scheduled = true; }
    bool isUpdateScheduled() const { return _scheduled; }
    virtual void update(float dt) = 0;

private:
    bool _scheduled;
};

class PhysicsLayer : public CCNode {
public:
    PhysicsLayer() { scheduleUpdate(); }

    void update(float dt) {
        std::cout << "PhysicsLayer::update(dt=" << dt << ")" << std::endl;
        _world.Step(dt, 8, 3);
    }

private:
    DemoBox2DWorld _world;
};

class CCScheduler {
public:
    void update(CCNode* target, float dt) {
        if (target && target->isUpdateScheduled()) {
            target->update(dt);
        }
    }
};

int main() {
    PhysicsLayer layer;
    CCScheduler scheduler;

    std::cout << "CCDirector::drawScene -> CCScheduler::update" << std::endl;
    scheduler.update(&layer, 0.04f);
    std::cout << "CCDirector continues to draw the scene" << std::endl;
    return 0;
}
