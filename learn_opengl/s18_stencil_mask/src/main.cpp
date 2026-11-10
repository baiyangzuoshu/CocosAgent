#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 1000;
constexpr int kWindowHeight = 640;
constexpr int kCircleSegments = 48;
constexpr int kMinMaskRadiusPercent = 25;
constexpr int kMaxMaskRadiusPercent = 65;
constexpr float kPi = 3.14159265358979323846F;

struct Vertex {
    float position[2];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint horizontalFit = -1;
    GLint scale = -1;
    GLint color = -1;
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;

uniform float uAspect;
uniform float uHorizontalFit;
uniform vec2 uScale;

void main() {
    vec2 position = aPosition * uScale;
    position.x *= uHorizontalFit / uAspect;
    gl_Position = vec4(position, 0.0, 1.0);
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
int gMaskRadiusPercent = 50;
bool gDrawable = false;

std::array<Vertex, kCircleSegments + 2> makeUnitCircleVertices() {
    std::array<Vertex, kCircleSegments + 2> vertices{};
    vertices[0] = { { 0.0F, 0.0F } };

    for (int segment = 0; segment <= kCircleSegments; ++segment) {
        const float angle = 2.0F * kPi * static_cast<float>(segment)
            / static_cast<float>(kCircleSegments);
        vertices[static_cast<std::size_t>(segment + 1)] = {
            { std::cos(angle), std::sin(angle) },
        };
    }

    return vertices;
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = "Learn OpenGL - Left: stencil circle / Right: no stencil | radius: "
        + std::to_string(gMaskRadiusPercent) + "% (Up/Down)";
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
    if (action != GLFW_PRESS && action != GLFW_REPEAT) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
        return;
    }

    if (key == GLFW_KEY_UP) {
        gMaskRadiusPercent = std::min(gMaskRadiusPercent + 5, kMaxMaskRadiusPercent);
    } else if (key == GLFW_KEY_DOWN) {
        gMaskRadiusPercent = std::max(gMaskRadiusPercent - 5, kMinMaskRadiusPercent);
    } else {
        return;
    }

    updateWindowTitle(window);
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

void createMesh(
    const Vertex* vertices,
    std::size_t vertexCount,
    GLuint& vertexArray,
    GLuint& vertexBuffer
) {
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(
        GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(vertexCount * sizeof(Vertex)),
        vertices,
        GL_STATIC_DRAW
    );
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
}

void drawMesh(
    GLuint vertexArray,
    GLenum primitive,
    GLsizei vertexCount,
    const UniformLocations& uniforms,
    float aspect,
    const std::array<float, 2>& scale,
    const std::array<float, 4>& color
) {
    constexpr float kMaxHalfWidth = 0.70F;
    const float horizontalFit = std::min(1.0F, aspect / kMaxHalfWidth);
    glUniform1f(uniforms.aspect, aspect);
    glUniform1f(uniforms.horizontalFit, horizontalFit);
    glUniform2f(uniforms.scale, scale[0], scale[1]);
    glUniform4f(uniforms.color, color[0], color[1], color[2], color[3]);

    glBindVertexArray(vertexArray);
    glDrawArrays(primitive, 0, vertexCount);
}

void drawStencilPanel(
    GLuint circleVertexArray,
    GLuint quadVertexArray,
    const UniformLocations& uniforms,
    int x,
    int width,
    int height
) {
    const float aspect = static_cast<float>(width) / static_cast<float>(height);
    const float radius = static_cast<float>(gMaskRadiusPercent) / 100.0F;
    glViewport(x, 0, width, height);

    glEnable(GL_STENCIL_TEST);
    glStencilMask(0xFF);
    glStencilFunc(GL_ALWAYS, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);
    glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);
    drawMesh(
        circleVertexArray,
        GL_TRIANGLE_FAN,
        kCircleSegments + 2,
        uniforms,
        aspect,
        { radius, radius },
        { 1.0F, 1.0F, 1.0F, 1.0F }
    );

    glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
    glStencilMask(0x00);
    glStencilFunc(GL_EQUAL, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
    drawMesh(
        quadVertexArray,
        GL_TRIANGLE_STRIP,
        4,
        uniforms,
        aspect,
        { 0.70F, 0.70F },
        { 0.18F, 0.78F, 0.94F, 1.0F }
    );

    glStencilMask(0xFF);
    glDisable(GL_STENCIL_TEST);
}

void drawUnmaskedPanel(
    GLuint quadVertexArray,
    const UniformLocations& uniforms,
    int x,
    int width,
    int height
) {
    const float aspect = static_cast<float>(width) / static_cast<float>(height);
    glViewport(x, 0, width, height);
    glDisable(GL_STENCIL_TEST);
    glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
    drawMesh(
        quadVertexArray,
        GL_TRIANGLE_STRIP,
        4,
        uniforms,
        aspect,
        { 0.70F, 0.70F },
        { 0.18F, 0.78F, 0.94F, 1.0F }
    );
}

void releaseResources(
    GLuint program,
    GLuint circleVertexBuffer,
    GLuint circleVertexArray,
    GLuint quadVertexBuffer,
    GLuint quadVertexArray
) {
    if (program != 0) {
        glDeleteProgram(program);
    }
    if (circleVertexBuffer != 0) {
        glDeleteBuffers(1, &circleVertexBuffer);
    }
    if (circleVertexArray != 0) {
        glDeleteVertexArrays(1, &circleVertexArray);
    }
    if (quadVertexBuffer != 0) {
        glDeleteBuffers(1, &quadVertexBuffer);
    }
    if (quadVertexArray != 0) {
        glDeleteVertexArrays(1, &quadVertexArray);
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
    glfwWindowHint(GLFW_STENCIL_BITS, 8);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif

    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        "Learn OpenGL - Left: stencil circle / Right: no stencil | radius: 50%",
        nullptr,
        nullptr
    );
    if (window == nullptr) {
        std::cerr << "Failed to create an OpenGL 3.3 window with a stencil buffer\n";
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

    GLint stencilBits = 0;
    glGetIntegerv(GL_STENCIL_BITS, &stencilBits);
    if (stencilBits < 1) {
        std::cerr << "The default framebuffer does not provide a stencil buffer\n";
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

    constexpr std::array<Vertex, 4> quadVertices{{
        { { -1.0F, -1.0F } },
        { {  1.0F, -1.0F } },
        { { -1.0F,  1.0F } },
        { {  1.0F,  1.0F } },
    }};
    const auto circleVertices = makeUnitCircleVertices();

    GLuint circleVertexArray = 0;
    GLuint circleVertexBuffer = 0;
    GLuint quadVertexArray = 0;
    GLuint quadVertexBuffer = 0;
    createMesh(
        circleVertices.data(),
        circleVertices.size(),
        circleVertexArray,
        circleVertexBuffer
    );
    createMesh(quadVertices.data(), quadVertices.size(), quadVertexArray, quadVertexBuffer);

    const GLuint program = createProgram();
    if (program == 0) {
        releaseResources(
            0,
            circleVertexBuffer,
            circleVertexArray,
            quadVertexBuffer,
            quadVertexArray
        );
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    const UniformLocations uniforms{
        glGetUniformLocation(program, "uAspect"),
        glGetUniformLocation(program, "uHorizontalFit"),
        glGetUniformLocation(program, "uScale"),
        glGetUniformLocation(program, "uColor"),
    };
    if (uniforms.aspect < 0 || uniforms.horizontalFit < 0
        || uniforms.scale < 0 || uniforms.color < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(
            program,
            circleVertexBuffer,
            circleVertexArray,
            quadVertexBuffer,
            quadVertexArray
        );
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glDisable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const int leftWidth = gFramebufferWidth / 2;
            const int rightWidth = gFramebufferWidth - leftWidth;

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glStencilMask(0xFF);
            glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
            glClearColor(0.035F, 0.045F, 0.065F, 1.0F);
            glClearStencil(0);
            glClear(GL_COLOR_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
            glUseProgram(program);

            drawStencilPanel(
                circleVertexArray,
                quadVertexArray,
                uniforms,
                0,
                leftWidth,
                gFramebufferHeight
            );
            drawUnmaskedPanel(
                quadVertexArray,
                uniforms,
                leftWidth,
                rightWidth,
                gFramebufferHeight
            );
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(
        program,
        circleVertexBuffer,
        circleVertexArray,
        quadVertexBuffer,
        quadVertexArray
    );
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
