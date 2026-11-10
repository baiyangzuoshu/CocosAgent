#pragma once

namespace cocos2d {

class PhysicsWorld {
public:
    PhysicsWorld();

    void setFixedUpdateRate(int updatesPerSecond);
    bool isAutoStep() const { return _autoStep; }
    void update(float delta);

private:
    void step(float delta);

    int _fixedRate;
    int _stepCount;
    float _updateTime;
    bool _autoStep;
};

}
