#include "cocos/renderer/CCRenderer.h"

int main() {
    Renderer renderer;
    MeshCommand body(20, true, 42, 36);
    renderer.addCommand(&body);
    renderer.render();
}
