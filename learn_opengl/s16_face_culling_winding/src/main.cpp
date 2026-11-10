#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 1000;
constexpr int kWindowHeight = 700;

struct Position {
    float x;
    float y;
    float z;
};

struct Vertex {
    float position[3];
    float color[3];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint cameraDistance = -1;
    GLint angleX = -1;
    GLint angleY = -1;
};

enum class CullMode {
    None,
    Back,
    Front,
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aColor;

uniform float uAspect;
uniform float uCameraDistance;
uniform float uAngleX;
uniform float uAngleY;
out vec3 vertexColor;

vec3 rotateX(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

vec3 rotateY(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
    vec3 worldPosition = rotateY(rotateX(aPosition, uAngleX), uAngleY);
    vec3 viewPosition = worldPosition - vec3(0.0, 0.0, uCameraDistance);

    const float nearPlane = 0.1;
    const float farPlane = 20.0;
    const float focalLength = 1.45;
    float clipZ = ((farPlane + nearPlane) / (nearPlane - farPlane)) * viewPosition.z
        + ((2.0 * farPlane * nearPlane) / (nearPlane - farPlane));
    gl_Position = vec4(
        viewPosition.x * focalLength / uAspect,
        viewPosition.y * focalLength,
        clipZ,
        -viewPosition.z
    );
    vertexColor = aColor;
}
)glsl";

const char* kFragmentShaderSource = R"glsl(
#version 330 core
in vec3 vertexColor;
out vec4 fragmentColor;

void main() {
    fragmentColor = vec4(vertexColor, 1.0);
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
CullMode gCullMode = CullMode::Back;
bool gFrontFaceCounterClockwise = true;
bool gInsideView = false;
bool gDrawable = false;

const char* cullModeName() {
    switch (gCullMode) {
    case CullMode::None:
        return "None";
    case CullMode::Back:
        return "Back";
    case CullMode::Front:
        return "Front";
    }
    return "Unknown";
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = std::string("Learn OpenGL - view: ")
        + (gInsideView ? "inside" : "outside")
        + " | cull: " + cullModeName()
        + " | front: " + (gFrontFaceCounterClockwise ? "CCW" : "CW")
        + " (I/C/W)";
    glfwSetWindowTitle(window, title.c_str());
}

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    gFramebufferWidth = width;
    gFramebufferHeight = height;
    gDrawable = width > 0 && height > 0;
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
        return;
    }

    if (key == GLFW_KEY_C) {
        if (gCullMode == CullMode::None) {
            gCullMode = CullMode::Back;
        } else if (gCullMode == CullMode::Back) {
            gCullMode = CullMode::Front;
        } else {
            gCullMode = CullMode::None;
        }
    } else if (key == GLFW_KEY_W) {
        gFrontFaceCounterClockwise = !gFrontFaceCounterClockwise;
    } else if (key == GLFW_KEY_I) {
        gInsideView = !gInsideView;
    } else {
        return;
    }

    updateWindowTitle(window);
}

std::array<Vertex, 36> makeCubeVertices() {
    constexpr float s = 0.58F;
    std::array<Vertex, 36> vertices{};
    std::size_t nextVertex = 0;

    const auto appendFace = [&](
        const std::array<Position, 4>& corners,
        const std::array<float, 3>& color
    ) {
        const std::array<Position, 6> triangles{{
            corners[0], corners[1], corners[2],
            corners[0], corners[2], corners[3],
        }};
        for (const Position& position : triangles) {
            vertices[nextVertex++] = {
                { position.x, position.y, position.z },
                { color[0], color[1], color[2] },
            };
        }
    };

    // Each face's corners are ordered counter-clockwise when viewed from outside.
    appendFace(
        std::array<Position, 4>{{
            { -s, -s,  s }, {  s, -s,  s }, {  s,  s,  s }, { -s,  s,  s },
        }},
        std::array<float, 3>{{ 0.95F, 0.25F, 0.22F }}
    ); // +Z
    appendFace(
        std::array<Position, 4>{{
            { -s, -s, -s }, { -s,  s, -s }, {  s,  s, -s }, {  s, -s, -s },
        }},
        std::array<float, 3>{{ 0.20F, 0.72F, 0.36F }}
    ); // -Z
    appendFace(
        std::array<Position, 4>{{
            {  s, -s, -s }, {  s,  s, -s }, {  s,  s,  s }, {  s, -s,  s },
        }},
        std::array<float, 3>{{ 0.98F, 0.56F, 0.12F }}
    ); // +X
    appendFace(
        std::array<Position, 4>{{
            { -s, -s, -s }, { -s, -s,  s }, { -s,  s,  s }, { -s,  s, -s },
        }},
        std::array<float, 3>{{ 0.62F, 0.30F, 0.90F }}
    ); // -X
    appendFace(
        std::array<Position, 4>{{
            { -s,  s, -s }, { -s,  s,  s }, {  s,  s,  s }, {  s,  s, -s },
        }},
        std::array<float, 3>{{ 0.96F, 0.82F, 0.20F }}
    ); // +Y
    appendFace(
        std::array<Position, 4>{{
            { -s, -s, -s }, {  s, -s, -s }, {  s, -s,  s }, { -s, -s,  s },
        }},
        std::array<float, 3>{{ 0.16F, 0.62F, 0.94F }}
    ); // -Y

    return vertices;
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

void applyRasterizerState() {
    glFrontFace(gFrontFaceCounterClockwise ? GL_CCW : GL_CW);
    if (gCullMode == CullMode::None) {
        glDisable(GL_CULL_FACE);
        return;
    }

    glEnable(GL_CULL_FACE);
    glCullFace(gCullMode == CullMode::Back ? GL_BACK : GL_FRONT);
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
        "Learn OpenGL - view: outside | cull: Back | front: CCW (I/C/W)",
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

    const auto vertices = makeCubeVertices();
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices.data(), GL_STATIC_DRAW);
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
        glGetUniformLocation(program, "uCameraDistance"),
        glGetUniformLocation(program, "uAngleX"),
        glGetUniformLocation(program, "uAngleY"),
    };
    if (uniforms.aspect < 0 || uniforms.cameraDistance < 0
        || uniforms.angleX < 0 || uniforms.angleY < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    applyRasterizerState();
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const float aspect = static_cast<float>(gFramebufferWidth)
                / static_cast<float>(gFramebufferHeight);
            const float time = static_cast<float>(glfwGetTime());

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glClearColor(0.035F, 0.045F, 0.065F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glUseProgram(program);
            glUniform1f(uniforms.aspect, aspect);
            glUniform1f(uniforms.cameraDistance, gInsideView ? 0.0F : 2.8F);
            glUniform1f(uniforms.angleX, time * 0.47F);
            glUniform1f(uniforms.angleY, time * 0.71F);
            applyRasterizerState();

            glBindVertexArray(vertexArray);
            glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(vertices.size()));
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, vertexBuffer, vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
