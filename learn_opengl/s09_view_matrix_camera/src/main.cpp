#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <vector>

#include "camera_matrix.h"
#include "shader_program.h"

using namespace lesson;

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;

struct Vertex {
    float position[3];
    float color[3];
};

Vertex makeVertex(float x, float y, const std::array<float, 3>& color) {
    return { { x, y, 0.0F }, { color[0], color[1], color[2] } };
}

void addLine(
    std::vector<Vertex>& vertices,
    float x1,
    float y1,
    float x2,
    float y2,
    const std::array<float, 3>& color
) {
    vertices.push_back(makeVertex(x1, y1, color));
    vertices.push_back(makeVertex(x2, y2, color));
}

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    const int side = std::min(width, height);
    glViewport((width - side) / 2, (height - side) / 2, side, side);
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
        "Learn OpenGL - View Matrix and Camera",
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

    glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
    int framebufferWidth = 0;
    int framebufferHeight = 0;
    glfwGetFramebufferSize(window, &framebufferWidth, &framebufferHeight);
    framebufferSizeCallback(window, framebufferWidth, framebufferHeight);

    const std::array<float, 3> gridColor{ 0.18F, 0.20F, 0.24F };
    const std::array<float, 3> axisColor{ 0.58F, 0.60F, 0.65F };
    const std::array<float, 3> triangleA{ 0.12F, 0.72F, 1.0F };
    const std::array<float, 3> triangleB{ 1.0F, 0.36F, 0.16F };
    const std::array<float, 3> triangleC{ 0.42F, 1.0F, 0.48F };
    const std::array<float, 3> originColor{ 1.0F, 0.30F, 0.22F };

    std::vector<Vertex> vertices;
    for (int step = -8; step <= 8; ++step) {
        if (step == 0) {
            continue;
        }
        const float coordinate = static_cast<float>(step) * 0.25F;
        addLine(vertices, coordinate, -2.0F, coordinate, 2.0F, gridColor);
        addLine(vertices, -2.0F, coordinate, 2.0F, coordinate, gridColor);
    }
    const GLsizei gridVertexCount = static_cast<GLsizei>(vertices.size());

    addLine(vertices, -2.0F, 0.0F, 2.0F, 0.0F, axisColor);
    addLine(vertices, 0.0F, -2.0F, 0.0F, 2.0F, axisColor);
    const GLint axesStart = gridVertexCount;
    const GLsizei axesVertexCount = static_cast<GLsizei>(vertices.size()) - gridVertexCount;

    const GLint triangleStart = static_cast<GLint>(vertices.size());
    vertices.push_back(makeVertex(0.55F, 0.25F, triangleA));
    vertices.push_back(makeVertex(1.05F, 0.25F, triangleB));
    vertices.push_back(makeVertex(0.80F, 0.75F, triangleC));

    const GLint originStart = static_cast<GLint>(vertices.size());
    vertices.push_back(makeVertex(0.0F, 0.0F, originColor));

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

    const GLint viewLocation = glGetUniformLocation(program, "uView");
    if (viewLocation < 0) {
        std::cerr << "Uniform uView was not found in the linked program\n";
        glDeleteProgram(program);
        glDeleteBuffers(1, &vertexBuffer);
        glDeleteVertexArrays(1, &vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    float cameraX = 0.0F;
    float cameraY = 0.0F;
    float cameraYaw = 0.0F;
    double previousFrameTime = glfwGetTime();

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        const double currentFrameTime = glfwGetTime();
        const float deltaTime = std::clamp(
            static_cast<float>(currentFrameTime - previousFrameTime),
            0.0F,
            0.1F
        );
        previousFrameTime = currentFrameTime;

        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        float localRight = 0.0F;
        float localUp = 0.0F;
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) localRight -= 1.0F;
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) localRight += 1.0F;
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) localUp -= 1.0F;
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) localUp += 1.0F;

        const float moveLength = std::sqrt(localRight * localRight + localUp * localUp);
        if (moveLength > 0.0F) {
            localRight /= moveLength;
            localUp /= moveLength;
        }

        const float cosine = std::cos(cameraYaw);
        const float sine = std::sin(cameraYaw);
        constexpr float kMoveSpeed = 1.2F;
        cameraX += (cosine * localRight - sine * localUp) * kMoveSpeed * deltaTime;
        cameraY += (sine * localRight + cosine * localUp) * kMoveSpeed * deltaTime;

        float turnDirection = 0.0F;
        if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS) turnDirection += 1.0F;
        if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS) turnDirection -= 1.0F;
        constexpr float kTurnSpeed = 1.5F;
        cameraYaw += turnDirection * kTurnSpeed * deltaTime;

        const Mat4 cameraTranslation = translationMatrix(-cameraX, -cameraY, 0.0F);
        const Mat4 cameraRotation = rotationZMatrix(-cameraYaw);
        const Mat4 view = multiply(cameraRotation, cameraTranslation);

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glUniformMatrix4fv(viewLocation, 1, GL_FALSE, view.values.data());
        glBindVertexArray(vertexArray);
        glDrawArrays(GL_LINES, 0, gridVertexCount);
        glDrawArrays(GL_LINES, axesStart, axesVertexCount);
        glDrawArrays(GL_TRIANGLES, triangleStart, 3);
        glPointSize(10.0F);
        glDrawArrays(GL_POINTS, originStart, 1);

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
