#include "cocos/2d/CCSpriteBatchNode.h"

int main() {
    SpriteBatchNode batch("ui.png");
    batch.addChild({"icon", "ui.png"});
    batch.addChild({"button", "ui.png"});

    Renderer renderer;
    batch.draw(renderer);
    renderer.render();
}
