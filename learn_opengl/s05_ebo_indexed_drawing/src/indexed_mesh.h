#pragma once

#include <glad/glad.h>

namespace lesson {

struct IndexedMesh {
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    GLuint indexBuffer = 0;
    GLsizei indexCount = 0;
};

IndexedMesh createIndexedMesh();
void destroyIndexedMesh(IndexedMesh* mesh);

} // namespace lesson
