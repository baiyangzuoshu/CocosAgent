#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 1000;
constexpr int kWindowHeight = 640;

struct Vertex {
    float position[2];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint horizontalFit = -1;
    GLint halfSize = -1;
    GLint offset = -1;
    GLint depth = -1;
    GLint color = -1;
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;

uniform float uAspect;
uniform float uHorizontalFit;
uniform vec2 uHalfSize;
uniform vec2 uOffset;
uniform float uDepth;

void main() {
    vec2 position = aPosition * uHalfSize + uOffset;
    position.x *= uHorizontalFit / uAspect;
    gl_Position = vec4(position, uDepth, 1.0);
}
)glsl";

const char* kFragmentShaderSource = R"glsl(
#version 330 core
uniform vec4 uColor;
out vec4 fragmentColor;

void main() {
    fragmentColor = uColor;
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
bool gDepthTestEnabled = true;
bool gDrawable = false;

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = std::string("Learn OpenGL - depth test: ")
        + (gDepthTestEnabled ? "ON" : "OFF")
        + " | Left: far to near / Right: near to far (D)";
    glfwSetWindowTitle(window, title.c_str());
}

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    gFramebufferWidth = width;
    gFramebufferHeight = height;
    gDrawable = width >= 2 && height > 0;
    if (gDrawable) {
        glViewport(0, 0, width, height);
    }
}

void keyCallback(GLFWwindow* window, int key, int, int action, int) {
    if (action != GLFW_PRESS) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    } else if (key == GLFW_KEY_D) {
        gDepthTestEnabled = !gDepthTestEnabled;
        updateWindowTitle(window);
    }
}

GLuint compileShader(GLenum type, const char* source) {
    const GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint compiled = GL_FALSE;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
    if (compiled == GL_FALSE) {
        GLint logLength = 0;
        glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &logLength);
        if (logLength > 1) {
            std::string log(static_cast<std::size_t>(logLength), '\0');
            GLsizei written = 0;
            glGetShaderInfoLog(shader, logLength, &written, log.data());
            log.resize(static_cast<std::size_t>(written));
            std::cerr << "Shader compilation failed:\n" << log << '\n';
        }
        glDeleteShader(shader);
        return 0;
    }

    return shader;
}

GLuint createProgram() {
    const GLuint vertexShader = compileShader(GL_VERTEX_SHADER, kVertexShaderSource);
    if (vertexShader == 0) {
        return 0;
    }

    const GLuint fragmentShader = compileShader(GL_FRAGMENT_SHADER, kFragmentShaderSource);
    if (fragmentShader == 0) {
        glDeleteShader(vertexShader);
        return 0;
    }

    const GLuint program = glCreateProgram();
    glAttachShader(program, vertexShader);
    glAttachShader(program, fragmentShader);
    glLinkProgram(program);

    GLint linked = GL_FALSE;
    glGetProgramiv(program, GL_LINK_STATUS, &linked);
    if (linked == GL_FALSE) {
        GLint logLength = 0;
        glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
        if (logLength > 1) {
            std::string log(static_cast<std::size_t>(logLength), '\0');
            GLsizei written = 0;
            glGetProgramInfoLog(program, logLength, &written, log.data());
            log.resize(static_cast<std::size_t>(written));
            std::cerr << "Program link failed:\n" << log << '\n';
        }
        glDeleteProgram(program);
        glDeleteShader(vertexShader);
        glDeleteShader(fragmentShader);
        return 0;
    }

    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);
    return program;
}

void drawQuad(
    GLuint vertexArray,
    const UniformLocations& uniforms,
    float aspect,
    const std::array<float, 2>& halfSize,
    const std::array<float, 2>& offset,
    float depth,
    const std::array<float, 4>& color
) {
    constexpr float kMaxHalfWidth = 0.66F;
    const float horizontalFit = std::min(1.0F, aspect / kMaxHalfWidth);
    glUniform1f(uniforms.aspect, aspect);
    glUniform1f(uniforms.horizontalFit, horizontalFit);
    glUniform2f(uniforms.halfSize, halfSize[0], halfSize[1]);
    glUniform2f(uniforms.offset, offset[0], offset[1]);
    glUniform1f(uniforms.depth, depth);
    glUniform4f(uniforms.color, color[0], color[1], color[2], color[3]);

    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}

void drawPanel(
    GLuint vertexArray,
    const UniformLocations& uniforms,
    int x,
    int width,
    int height,
    bool reverseOrder
) {
    const float aspect = static_cast<float>(width) / static_cast<float>(height);
    glViewport(x, 0, width, height);

    const auto drawFarBlue = [&]() {
        drawQuad(
            vertexArray,
            uniforms,
            aspect,
            { 0.38F, 0.38F },
            { -0.15F, 0.12F },
            0.35F,
            { 0.10F, 0.40F, 0.96F, 1.0F }
        );
    };
    const auto drawNearOrange = [&]() {
        drawQuad(
            vertexArray,
            uniforms,
            aspect,
            { 0.38F, 0.38F },
            { 0.15F, -0.12F },
            -0.35F,
            { 0.98F, 0.26F, 0.06F, 1.0F }
        );
    };

    if (reverseOrder) {
        drawNearOrange();
        drawFarBlue();
    } else {
        drawFarBlue();
        drawNearOrange();
    }
}

void releaseResources(GLuint program, GLuint vertexBuffer, GLuint vertexArray) {
    if (program != 0) {
        glDeleteProgram(program);
    }
    if (vertexBuffer != 0) {
        glDeleteBuffers(1, &vertexBuffer);
    }
    if (vertexArray != 0) {
        glDeleteVertexArrays(1, &vertexArray);
    }
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
    glfwWindowHint(GLFW_DEPTH_BITS, 24);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif

    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        "Learn OpenGL - depth test: ON | Left: far to near / Right: near to far",
        nullptr,
        nullptr
    );
    if (window == nullptr) {
        std::cerr << "Failed to create an OpenGL 3.3 window with a depth buffer\n";
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
    glfwSetKeyCallback(window, keyCallback);
    int framebufferWidth = 0;
    int framebufferHeight = 0;
    glfwGetFramebufferSize(window, &framebufferWidth, &framebufferHeight);
    framebufferSizeCallback(window, framebufferWidth, framebufferHeight);

    constexpr std::array<Vertex, 4> vertices{{
        { { -1.0F, -1.0F } },
        { {  1.0F, -1.0F } },
        { { -1.0F,  1.0F } },
        { {  1.0F,  1.0F } },
    }};

    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(
        0,
        2,
        GL_FLOAT,
        GL_FALSE,
        static_cast<GLsizei>(sizeof(Vertex)),
        nullptr
    );
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    const GLuint program = createProgram();
    if (program == 0) {
        releaseResources(0, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    const UniformLocations uniforms{
        glGetUniformLocation(program, "uAspect"),
        glGetUniformLocation(program, "uHorizontalFit"),
        glGetUniformLocation(program, "uHalfSize"),
        glGetUniformLocation(program, "uOffset"),
        glGetUniformLocation(program, "uDepth"),
        glGetUniformLocation(program, "uColor"),
    };
    if (uniforms.aspect < 0 || uniforms.horizontalFit < 0 || uniforms.halfSize < 0
        || uniforms.offset < 0 || uniforms.depth < 0 || uniforms.color < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glDepthMask(GL_TRUE);
    glDisable(GL_CULL_FACE);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const int leftWidth = gFramebufferWidth / 2;
            const int rightWidth = gFramebufferWidth - leftWidth;

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glDepthMask(GL_TRUE);
            glClearColor(0.035F, 0.045F, 0.065F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            if (gDepthTestEnabled) {
                glEnable(GL_DEPTH_TEST);
            } else {
                glDisable(GL_DEPTH_TEST);
            }
            glUseProgram(program);

            drawPanel(vertexArray, uniforms, 0, leftWidth, gFramebufferHeight, false);
            drawPanel(vertexArray, uniforms, leftWidth, rightWidth, gFramebufferHeight, true);

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, vertexBuffer, vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
