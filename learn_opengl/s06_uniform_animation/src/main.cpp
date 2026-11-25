#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <iostream>

#include "shader_program.h"
#include "triangle_mesh.h"

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    glViewport(0, 0, width, height);
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
        "Learn OpenGL - Uniform Animation",
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

    lesson::TriangleMesh triangleMesh = lesson::createTriangleMesh();

    const GLuint program = lesson::createProgram();
    if (program == 0) {
        lesson::destroyTriangleMesh(&triangleMesh);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const GLint timeLocation = glGetUniformLocation(program, "uTime");
    if (timeLocation < 0) {
        std::cerr << "Uniform uTime was not found in the linked program\n";
        glDeleteProgram(program);
        lesson::destroyTriangleMesh(&triangleMesh);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);

        glUseProgram(program);
        glUniform1f(timeLocation, static_cast<GLfloat>(glfwGetTime()));
        glBindVertexArray(triangleMesh.vertexArray);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glDeleteProgram(program);
    lesson::destroyTriangleMesh(&triangleMesh);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
