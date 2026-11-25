#include <glad/glad.h>

#include <cstddef>

#include "indexed_mesh.h"

namespace lesson {
namespace {

struct Vertex {
    float position[3];
    float color[3];
};

} // namespace

IndexedMesh createIndexedMesh() {
    const Vertex vertices[] = {
        { { -0.65F, -0.55F, 0.0F }, { 1.0F, 0.2F, 0.2F } },
        { {  0.65F, -0.55F, 0.0F }, { 0.2F, 1.0F, 0.3F } },
        { {  0.65F,  0.55F, 0.0F }, { 0.2F, 0.4F, 1.0F } },
        { { -0.65F,  0.55F, 0.0F }, { 1.0F, 0.8F, 0.2F } },
    };
    const GLuint indices[] = { 0, 1, 2, 2, 3, 0 };

    IndexedMesh mesh;
    mesh.indexCount = static_cast<GLsizei>(sizeof(indices) / sizeof(indices[0]));
    glGenVertexArrays(1, &mesh.vertexArray);
    glGenBuffers(1, &mesh.vertexBuffer);
    glGenBuffers(1, &mesh.indexBuffer);

    glBindVertexArray(mesh.vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, mesh.vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    glVertexAttribPointer(
        0, 3, GL_FLOAT, GL_FALSE, static_cast<GLsizei>(sizeof(Vertex)),
        reinterpret_cast<const void*>(offsetof(Vertex, position))
    );
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(
        1, 3, GL_FLOAT, GL_FALSE, static_cast<GLsizei>(sizeof(Vertex)),
        reinterpret_cast<const void*>(offsetof(Vertex, color))
    );
    glEnableVertexAttribArray(1);

    // The EBO binding belongs to this VAO and is retained after unbinding it.
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    return mesh;
}

void destroyIndexedMesh(IndexedMesh* mesh) {
    if (mesh->indexBuffer != 0) glDeleteBuffers(1, &mesh->indexBuffer);
    if (mesh->vertexBuffer != 0) glDeleteBuffers(1, &mesh->vertexBuffer);
    if (mesh->vertexArray != 0) glDeleteVertexArrays(1, &mesh->vertexArray);
    *mesh = {};
}

} // namespace lesson
