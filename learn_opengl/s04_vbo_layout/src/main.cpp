#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <iostream>

#include "shader_program.h"
#include "vertex_buffers.h"

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;
void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    glViewport(0, 0, width, height);
}

} // namespace

int main(int argc, char** argv) {
    lesson::VertexLayout layout = lesson::VertexLayout::Interleaved;
    if (!lesson::parseLayout(argc, argv, &layout)) {
        std::cerr << "Usage: learn_opengl_s04_vbo [--interleaved|--separate]\n";
        return 1;
    }

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

    const char* windowTitle = layout == lesson::VertexLayout::Interleaved
        ? "Learn OpenGL - Interleaved VBO"
        : "Learn OpenGL - Separate VBOs";
    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        windowTitle,
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

    const GLuint program = lesson::createProgram();
    if (program == 0) {
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    lesson::VertexBuffers buffers = lesson::createVertexBuffers(layout);
    bool raised = false;
    bool spaceWasPressed = false;

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        const bool spaceIsPressed = glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS;
        if (spaceIsPressed && !spaceWasPressed) {
            raised = !raised;
            lesson::updateApexPosition(buffers, layout, raised ? 0.85F : 0.65F);
        }
        spaceWasPressed = spaceIsPressed;

        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glBindVertexArray(buffers.vertexArray);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    lesson::deleteVertexBuffers(&buffers);
    glDeleteProgram(program);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
