#pragma once

#include <GLFW/glfw3.h>

namespace lesson {

struct ViewportState {
    int framebufferWidth = 0;
    int framebufferHeight = 0;
    int viewportWidth = 0;
    int viewportHeight = 0;
    bool square = false;
};

void initializeViewport(GLFWwindow* window, ViewportState* state);
void toggleSquareViewport(ViewportState* state);
float viewportAspect(const ViewportState& state);

} // namespace lesson
