#pragma once

#include <glad/glad.h>

namespace lesson {

struct VertexInput {
    GLuint vertexArray = 0;
    GLuint positionBuffer = 0;
    GLuint colorBuffer = 0;
};

VertexInput createVertexInput();
void destroyVertexInput(VertexInput* input);

} // namespace lesson
