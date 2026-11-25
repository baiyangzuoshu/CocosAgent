#include <glad/glad.h>

#include <cstddef>
#include <string>

#include "vertex_buffers.h"

namespace lesson {
namespace {

constexpr GLsizei kFloat3Stride = 3 * static_cast<GLsizei>(sizeof(float));

struct Vertex {
    float position[3];
    float color[3];
};

const Vertex kInterleavedVertices[] = {
    {{-0.65F, -0.55F, 0.0F}, {1.0F, 0.2F, 0.2F}},
    {{ 0.65F, -0.55F, 0.0F}, {0.2F, 1.0F, 0.3F}},
    {{ 0.00F,  0.65F, 0.0F}, {0.2F, 0.4F, 1.0F}},
};

const float kPositions[] = {
    -0.65F, -0.55F, 0.0F,
     0.65F, -0.55F, 0.0F,
     0.00F,  0.65F, 0.0F,
};

const float kColors[] = {
    1.0F, 0.2F, 0.2F,
    0.2F, 1.0F, 0.3F,
    0.2F, 0.4F, 1.0F,
};

} // namespace

bool parseLayout(int argc, char** argv, VertexLayout* layout) {
    *layout = VertexLayout::Interleaved;
    if (argc == 1) {
        return true;
    }
    if (argc == 2 && std::string(argv[1]) == "--separate") {
        *layout = VertexLayout::Separate;
        return true;
    }
    if (argc == 2 && std::string(argv[1]) == "--interleaved") {
        return true;
    }
    return false;
}

VertexBuffers createVertexBuffers(VertexLayout layout) {
    VertexBuffers buffers;
    glGenVertexArrays(1, &buffers.vertexArray);
    glBindVertexArray(buffers.vertexArray);

    if (layout == VertexLayout::Interleaved) {
        glGenBuffers(1, &buffers.interleaved);
        glBindBuffer(GL_ARRAY_BUFFER, buffers.interleaved);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(sizeof(kInterleavedVertices)),
            kInterleavedVertices,
            GL_DYNAMIC_DRAW
        );

        const GLsizei stride = static_cast<GLsizei>(sizeof(Vertex));
        glVertexAttribPointer(
            0,
            3,
            GL_FLOAT,
            GL_FALSE,
            stride,
            reinterpret_cast<const void*>(offsetof(Vertex, position))
        );
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(
            1,
            3,
            GL_FLOAT,
            GL_FALSE,
            stride,
            reinterpret_cast<const void*>(offsetof(Vertex, color))
        );
        glEnableVertexAttribArray(1);
    } else {
        glGenBuffers(1, &buffers.positions);
        glBindBuffer(GL_ARRAY_BUFFER, buffers.positions);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(sizeof(kPositions)),
            kPositions,
            GL_DYNAMIC_DRAW
        );
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, kFloat3Stride, nullptr);
        glEnableVertexAttribArray(0);

        glGenBuffers(1, &buffers.colors);
        glBindBuffer(GL_ARRAY_BUFFER, buffers.colors);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(sizeof(kColors)),
            kColors,
            GL_DYNAMIC_DRAW
        );
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, kFloat3Stride, nullptr);
        glEnableVertexAttribArray(1);
    }

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    return buffers;
}

void updateApexPosition(const VertexBuffers& buffers, VertexLayout layout, float y) {
    const float newPosition[] = {0.0F, y, 0.0F};
    GLintptr byteOffset = 0;
    GLuint buffer = 0;

    if (layout == VertexLayout::Interleaved) {
        buffer = buffers.interleaved;
        byteOffset = static_cast<GLintptr>(
            2 * sizeof(Vertex) + offsetof(Vertex, position)
        );
    } else {
        buffer = buffers.positions;
        byteOffset = static_cast<GLintptr>(2 * 3 * sizeof(float));
    }

    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    glBufferSubData(
        GL_ARRAY_BUFFER,
        byteOffset,
        static_cast<GLsizeiptr>(sizeof(newPosition)),
        newPosition
    );
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

void deleteVertexBuffers(VertexBuffers* buffers) {
    if (buffers->colors != 0) {
        glDeleteBuffers(1, &buffers->colors);
    }
    if (buffers->positions != 0) {
        glDeleteBuffers(1, &buffers->positions);
    }
    if (buffers->interleaved != 0) {
        glDeleteBuffers(1, &buffers->interleaved);
    }
    if (buffers->vertexArray != 0) {
        glDeleteVertexArrays(1, &buffers->vertexArray);
    }
}

} // namespace lesson
