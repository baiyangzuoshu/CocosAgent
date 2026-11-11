#include "cocos/2d/CCRenderTexture.h"

int main() {
    Renderer renderer;
    RenderTexture target(renderer);

    target.begin();
    target.addSceneDraw("scene triangles");
    target.end();
    renderer.render();
}
