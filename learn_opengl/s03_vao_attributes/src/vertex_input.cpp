#include <glad/glad.h>

#include "vertex_input.h"

namespace lesson {

VertexInput createVertexInput() {
    constexpr GLsizei vec3Stride = 3 * static_cast<GLsizei>(sizeof(float));
    const float positions[] = {
        -0.65F, -0.55F, 0.0F,
         0.65F, -0.55F, 0.0F,
         0.00F,  0.65F, 0.0F,
    };
    const float colors[] = {
        1.0F, 0.2F, 0.2F,
        0.2F, 1.0F, 0.3F,
        0.2F, 0.4F, 1.0F,
    };

    VertexInput input;
    glGenVertexArrays(1, &input.vertexArray);
    glGenBuffers(1, &input.positionBuffer);
    glGenBuffers(1, &input.colorBuffer);
    glBindVertexArray(input.vertexArray);

    glBindBuffer(GL_ARRAY_BUFFER, input.positionBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(positions), positions, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, vec3Stride, nullptr);
    glEnableVertexAttribArray(0);

    glBindBuffer(GL_ARRAY_BUFFER, input.colorBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors), colors, GL_STATIC_DRAW);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, vec3Stride, nullptr);
    glEnableVertexAttribArray(1);

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    return input;
}

void destroyVertexInput(VertexInput* input) {
    if (input->colorBuffer != 0) glDeleteBuffers(1, &input->colorBuffer);
    if (input->positionBuffer != 0) glDeleteBuffers(1, &input->positionBuffer);
    if (input->vertexArray != 0) glDeleteVertexArrays(1, &input->vertexArray);
    *input = {};
}

} // namespace lesson
