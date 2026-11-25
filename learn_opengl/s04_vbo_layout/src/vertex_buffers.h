#pragma once

#include <glad/glad.h>

namespace lesson {

enum class VertexLayout {
    Interleaved,
    Separate,
};

struct VertexBuffers {
    GLuint vertexArray = 0;
    GLuint interleaved = 0;
    GLuint positions = 0;
    GLuint colors = 0;
};

bool parseLayout(int argc, char** argv, VertexLayout* layout);
VertexBuffers createVertexBuffers(VertexLayout layout);
void updateApexPosition(const VertexBuffers& buffers, VertexLayout layout, float y);
void deleteVertexBuffers(VertexBuffers* buffers);

} // namespace lesson
