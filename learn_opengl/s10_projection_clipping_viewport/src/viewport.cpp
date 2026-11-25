#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>

#include "viewport.h"

namespace lesson {
namespace {

void applyViewport(ViewportState* state) {
    if (state->framebufferWidth <= 0 || state->framebufferHeight <= 0) {
        state->viewportWidth = 0;
        state->viewportHeight = 0;
        glViewport(0, 0, 0, 0);
        return;
    }

    int x = 0;
    int y = 0;
    state->viewportWidth = state->framebufferWidth;
    state->viewportHeight = state->framebufferHeight;
    if (state->square) {
        const int side = std::min(state->framebufferWidth, state->framebufferHeight);
        x = (state->framebufferWidth - side) / 2;
        y = (state->framebufferHeight - side) / 2;
        state->viewportWidth = side;
        state->viewportHeight = side;
    }
    glViewport(x, y, state->viewportWidth, state->viewportHeight);
}

void framebufferSizeCallback(GLFWwindow* window, int width, int height) {
    auto* state = static_cast<ViewportState*>(glfwGetWindowUserPointer(window));
    if (state == nullptr) return;
    state->framebufferWidth = width;
    state->framebufferHeight = height;
    applyViewport(state);
}

} // namespace

void initializeViewport(GLFWwindow* window, ViewportState* state) {
    glfwSetWindowUserPointer(window, state);
    glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
    glfwGetFramebufferSize(window, &state->framebufferWidth, &state->framebufferHeight);
    applyViewport(state);
}

void toggleSquareViewport(ViewportState* state) {
    state->square = !state->square;
    applyViewport(state);
}

float viewportAspect(const ViewportState& state) {
    if (state.viewportHeight <= 0) return 1.0F;
    return static_cast<float>(state.viewportWidth) / static_cast<float>(state.viewportHeight);
}

} // namespace lesson
