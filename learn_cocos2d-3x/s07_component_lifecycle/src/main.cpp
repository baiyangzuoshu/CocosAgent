#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCComponent.h"
#include <iostream>

using namespace cocos2d;

class PlayerLogic : public Component {
public:
    void onAdd() override { std::cout << "onAdd (attached)\n"; }
    void onEnter() override { std::cout << "onEnter (node enters scene)\n"; }
    void update(float delta) override { std::cout << "update dt=" << delta << "\n"; }
    void onExit() override { std::cout << "onExit (node leaves scene)\n"; }
    void onRemove() override { std::cout << "onRemove (detached)\n"; }
};

int main() {
    Node player;
    PlayerLogic logic;
    player.addComponent(&logic);
    player.onEnter();
    player.update(1.0f / 60.0f);
    player.onExit();
    player.removeComponent(&logic);
}
