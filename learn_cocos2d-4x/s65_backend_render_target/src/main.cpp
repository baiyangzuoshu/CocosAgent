#include "cocos/2d/CCRenderTexture.h"
#include "cocos/renderer/backend/opengl/CommandBufferGL.h"

int main() {
    CommandBufferGL commandBuffer;
    Renderer renderer(commandBuffer);
    RenderTexture target(renderer);

    target.begin();
    target.addSceneDraw();
    target.end();
    renderer.render();
    target.getSprite();
}
