#include <glad/glad.h>

#include "triangle_mesh.h"

namespace lesson {

TriangleMesh createTriangleMesh() {
    // 每个顶点包含位置 xyz 和颜色 rgb，共六个 float。
    const float vertices[] = {
        // position             // color
        -0.65F, -0.55F, 0.0F,    1.0F, 0.2F, 0.2F,
         0.65F, -0.55F, 0.0F,    0.2F, 1.0F, 0.3F,
         0.00F,  0.65F, 0.0F,    0.2F, 0.4F, 1.0F,
    };

    TriangleMesh mesh;
    glGenVertexArrays(1, &mesh.vertexArray);
    glGenBuffers(1, &mesh.vertexBuffer);

    // VBO 保存顶点字节；VAO 记录位置和颜色的读取布局。
    glBindVertexArray(mesh.vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, mesh.vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    constexpr GLsizei stride = 6 * static_cast<GLsizei>(sizeof(float));
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, nullptr);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(
        1, 3, GL_FLOAT, GL_FALSE, stride,
        reinterpret_cast<void*>(3 * sizeof(float))
    );
    glEnableVertexAttribArray(1);
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
