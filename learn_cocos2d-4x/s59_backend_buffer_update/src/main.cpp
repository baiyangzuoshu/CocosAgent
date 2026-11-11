#include "cocos/renderer/CCRenderer.h"
#include "cocos/renderer/backend/opengl/BufferGL.h"

#include <utility>

int main() {
    backend::BufferGL vertexBuffer;
    backend::BufferGL indexBuffer;
    Renderer renderer(vertexBuffer, indexBuffer);

    TrianglesCommand command;
    command.setTriangles(
        {
            {0, 0, 0, {255, 255, 255, 255}, 0, 0},
            {64, 0, 0, {255, 255, 255, 255}, 1, 0},
            {0, 32, 0, {255, 255, 255, 255}, 0, 1},
            {64, 32, 0, {255, 255, 255, 255}, 1, 1},
        },
        {0, 1, 2, 1, 3, 2});

    renderer.fillVerticesAndIndices(command);
    renderer.uploadBuffers();
}
