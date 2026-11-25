#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <array>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

#include "projection_matrix.h"
#include "shader_program.h"
#include "viewport.h"

using namespace lesson;

lesson::ViewportState gViewport;

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;
constexpr float kNearPlane = 0.1F;
constexpr float kFarPlane = 10.0F;
constexpr float kPerspectiveFovRadians = 0.78539816339F;
constexpr float kOrthographicHeight = 4.0F;

struct Vertex {
    float position[3];
    float color[3];
};

bool gPerspectiveProjection = true;

Vertex makeVertex(float x, float y, float z, const std::array<float, 3>& color) {
    return { { x, y, z }, { color[0], color[1], color[2] } };
}

void addQuad(
    std::vector<Vertex>& vertices,
    float centerX,
    float centerY,
    float z,
    float halfSize,
    const std::array<float, 3>& color
) {
    const float left = centerX - halfSize;
    const float right = centerX + halfSize;
    const float bottom = centerY - halfSize;
    const float top = centerY + halfSize;

    vertices.push_back(makeVertex(left, bottom, z, color));
    vertices.push_back(makeVertex(right, bottom, z, color));
    vertices.push_back(makeVertex(right, top, z, color));
    vertices.push_back(makeVertex(left, bottom, z, color));
    vertices.push_back(makeVertex(right, top, z, color));
    vertices.push_back(makeVertex(left, top, z, color));
}

void updateWindowTitle(GLFWwindow* window) {
    const char* projection = gPerspectiveProjection ? "Perspective" : "Orthographic";
    const char* viewport = gViewport.square ? "Square viewport" : "Full viewport";
    const std::string title = std::string("Learn OpenGL - ") + projection + " / " + viewport;
    glfwSetWindowTitle(window, title.c_str());
}

void keyCallback(GLFWwindow* window, int key, int, int action, int) {
    if (action != GLFW_PRESS) {
        return;
    }

    if (key == GLFW_KEY_P) {
        gPerspectiveProjection = true;
    } else if (key == GLFW_KEY_O) {
        gPerspectiveProjection = false;
    } else if (key == GLFW_KEY_V) {
        lesson::toggleSquareViewport(&gViewport);
    }
    updateWindowTitle(window);
}

} // namespace

int main() {
    if (glfwInit() != GLFW_TRUE) {
        std::cerr << "Failed to initialize GLFW\n";
        return 1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif

    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        "Learn OpenGL - Perspective / Full viewport",
        nullptr,
        nullptr
    );
    if (window == nullptr) {
        std::cerr << "Failed to create an OpenGL 3.3 window\n";
        glfwTerminate();
        return 1;
    }

    glfwMakeContextCurrent(window);
    if (gladLoadGLLoader(reinterpret_cast<GLADloadproc>(glfwGetProcAddress)) == 0) {
        std::cerr << "Failed to load OpenGL functions with GLAD\n";
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    lesson::initializeViewport(window, &gViewport);
    glfwSetKeyCallback(window, keyCallback);
    updateWindowTitle(window);

    const std::array<float, 3> nearColor{ 0.12F, 0.68F, 1.0F };
    const std::array<float, 3> middleColor{ 1.0F, 0.38F, 0.18F };
    const std::array<float, 3> farColor{ 0.38F, 0.95F, 0.42F };
    const std::array<float, 3> clippingColor{ 0.82F, 0.30F, 1.0F };
    std::vector<Vertex> vertices;
    addQuad(vertices, -0.55F, 0.75F, -2.0F, 0.35F, nearColor);
    addQuad(vertices, 0.0F, 0.0F, -4.0F, 0.35F, middleColor);
    addQuad(vertices, 1.2F, -0.8F, -6.0F, 0.35F, farColor);
    addQuad(vertices, 1.0F, 0.85F, -2.0F, 0.25F, clippingColor);

    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);

    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(
        GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(vertices.size() * sizeof(Vertex)),
        vertices.data(),
        GL_STATIC_DRAW
    );
    glVertexAttribPointer(
        0,
        3,
        GL_FLOAT,
        GL_FALSE,
        static_cast<GLsizei>(sizeof(Vertex)),
        nullptr
    );
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(
        1,
        3,
        GL_FLOAT,
        GL_FALSE,
        static_cast<GLsizei>(sizeof(Vertex)),
        reinterpret_cast<const void*>(offsetof(Vertex, color))
    );
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    const GLuint program = lesson::createProgram();
    if (program == 0) {
        glDeleteBuffers(1, &vertexBuffer);
        glDeleteVertexArrays(1, &vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const GLint projectionLocation = glGetUniformLocation(program, "uProjection");
    if (projectionLocation < 0) {
        std::cerr << "Uniform uProjection was not found in the linked program\n";
        glDeleteProgram(program);
        glDeleteBuffers(1, &vertexBuffer);
        glDeleteVertexArrays(1, &vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        if (gViewport.viewportHeight <= 0) {
            glfwPollEvents();
            continue;
        }
        const float aspect = lesson::viewportAspect(gViewport);
        const Mat4 projection = gPerspectiveProjection
            ? perspectiveMatrix(kPerspectiveFovRadians, aspect, kNearPlane, kFarPlane)
            : orthographicMatrix(kOrthographicHeight, aspect, kNearPlane, kFarPlane);

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glUniformMatrix4fv(projectionLocation, 1, GL_FALSE, projection.values.data());
        glBindVertexArray(vertexArray);
        glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(vertices.size()));

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glDeleteProgram(program);
    glDeleteBuffers(1, &vertexBuffer);
    glDeleteVertexArrays(1, &vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
