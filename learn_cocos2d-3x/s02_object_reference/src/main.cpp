#include "cocos/base/CCRef.h"
#include "cocos/base/CCAutoreleasePool.h"

#include <iostream>

class Probe : public cocos2d::Ref {
public:
    ~Probe() override {
        std::cout << "destroy Probe\n";
    }
};

int main() {
    cocos2d::AutoreleasePool pool;
    auto* object = new Probe();

    object->retain();
    std::cout << "after retain: " << object->getReferenceCount() << '\n';
    object->autorelease();
    pool.clear();
    std::cout << "after pool clear: " << object->getReferenceCount() << '\n';
    object->release();
    return 0;
}
