#include <glad/glad.h>

#include "triangle_mesh.h"

namespace lesson {

TriangleMesh createTriangleMesh() {
    const float positions[] = {
        -0.65F, -0.55F, 0.0F,
         0.65F, -0.55F, 0.0F,
         0.00F,  0.65F, 0.0F,
    };

    TriangleMesh mesh;
    glGenVertexArrays(1, &mesh.vertexArray);
    glGenBuffers(1, &mesh.vertexBuffer);
    glBindVertexArray(mesh.vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, mesh.vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(positions), positions, GL_STATIC_DRAW);
    glVertexAttribPointer(
        0, 3, GL_FLOAT, GL_FALSE,
        3 * static_cast<GLsizei>(sizeof(float)), nullptr
    );
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    return mesh;
}

void destroyTriangleMesh(TriangleMesh* mesh) {
    if (mesh->vertexBuffer != 0) glDeleteBuffers(1, &mesh->vertexBuffer);
    if (mesh->vertexArray != 0) glDeleteVertexArrays(1, &mesh->vertexArray);
    *mesh = {};
}

} // namespace lesson
