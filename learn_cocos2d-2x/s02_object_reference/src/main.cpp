#include "cocos2dx/cocoa/CCObject.h"
#include "cocos2dx/cocoa/CCAutoreleasePool.h"

#include <iostream>

class Probe : public cocos2d::CCObject {
public:
    ~Probe() override {
        std::cout << "destroy Probe\n";
    }
};

int main() {
    cocos2d::CCAutoreleasePool pool;
    auto* object = new Probe();

    object->retain();
    std::cout << "after retain: " << object->retainCount() << '\n';
    object->autorelease();
    pool.clear();
    std::cout << "after pool clear: " << object->retainCount() << '\n';
    object->release();
    return 0;
}
