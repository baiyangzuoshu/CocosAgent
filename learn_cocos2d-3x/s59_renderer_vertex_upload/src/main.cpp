#include "cocos/renderer/CCRenderer.h"

#include <utility>

int main() {
    GLDevice gl;
    Renderer renderer(gl);

    TrianglesCommand command;
    command.setTriangles(
        {
            {0, 0, 0, {255, 255, 255, 255}, 0, 0},
            {64, 0, 0, {255, 255, 255, 255}, 1, 0},
            {0, 32, 0, {255, 255, 255, 255}, 0, 1},
            {64, 32, 0, {255, 255, 255, 255}, 1, 1},
        },
        {0, 1, 2, 1, 3, 2});

    renderer.addCommand(command);
    renderer.drawBatchedTriangles();
}
