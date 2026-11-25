#pragma once

#include <glad/glad.h>

namespace lesson {

struct TriangleMesh {
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
};

TriangleMesh createTriangleMesh();
void destroyTriangleMesh(TriangleMesh* mesh);

} // namespace lesson
