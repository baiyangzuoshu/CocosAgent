#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;
constexpr float kNearPlane = 0.1F;
constexpr float kFarPlane = 10.0F;
constexpr float kPerspectiveFovRadians = 0.78539816339F;
constexpr float kOrthographicHeight = 4.0F;

struct Mat4 {
    std::array<float, 16> values{};

    float& at(std::size_t row, std::size_t column) {
        return values[column * 4 + row];
    }
};

struct Vertex {
    float position[3];
    float color[3];
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aColor;

uniform mat4 uProjection;
out vec3 vertexColor;

void main() {
    gl_Position = uProjection * vec4(aPosition, 1.0);
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
int gViewportWidth = 0;
int gViewportHeight = 0;
bool gSquareViewport = false;
bool gPerspectiveProjection = true;

Mat4 perspectiveMatrix(float verticalFovRadians, float aspect, float nearPlane, float farPlane) {
    Mat4 result{};
    const float scale = 1.0F / std::tan(verticalFovRadians * 0.5F);
    result.at(0, 0) = scale / aspect;
    result.at(1, 1) = scale;
    result.at(2, 2) = (farPlane + nearPlane) / (nearPlane - farPlane);
    result.at(2, 3) = (2.0F * farPlane * nearPlane) / (nearPlane - farPlane);
    result.at(3, 2) = -1.0F;
    return result;
}

Mat4 orthographicMatrix(float height, float aspect, float nearPlane, float farPlane) {
    Mat4 result{};
    const float halfHeight = height * 0.5F;
    const float halfWidth = halfHeight * aspect;
    result.at(0, 0) = 1.0F / halfWidth;
    result.at(1, 1) = 1.0F / halfHeight;
    result.at(2, 2) = -2.0F / (farPlane - nearPlane);
    result.at(2, 3) = -(farPlane + nearPlane) / (farPlane - nearPlane);
    result.at(3, 3) = 1.0F;
    return result;
}

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

void applyViewport() {
    if (gFramebufferWidth <= 0 || gFramebufferHeight <= 0) {
        gViewportWidth = 0;
        gViewportHeight = 0;
        glViewport(0, 0, 0, 0);
        return;
    }

    int x = 0;
    int y = 0;
    gViewportWidth = gFramebufferWidth;
    gViewportHeight = gFramebufferHeight;
    if (gSquareViewport) {
        const int side = std::min(gFramebufferWidth, gFramebufferHeight);
        x = (gFramebufferWidth - side) / 2;
        y = (gFramebufferHeight - side) / 2;
        gViewportWidth = side;
        gViewportHeight = side;
    }
    glViewport(x, y, gViewportWidth, gViewportHeight);
}

void updateWindowTitle(GLFWwindow* window) {
    const char* projection = gPerspectiveProjection ? "Perspective" : "Orthographic";
    const char* viewport = gSquareViewport ? "Square viewport" : "Full viewport";
    const std::string title = std::string("Learn OpenGL - ") + projection + " / " + viewport;
    glfwSetWindowTitle(window, title.c_str());
}

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    gFramebufferWidth = width;
    gFramebufferHeight = height;
    applyViewport();
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
        gSquareViewport = !gSquareViewport;
        applyViewport();
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

    glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
    glfwSetKeyCallback(window, keyCallback);
    int framebufferWidth = 0;
    int framebufferHeight = 0;
    glfwGetFramebufferSize(window, &framebufferWidth, &framebufferHeight);
    framebufferSizeCallback(window, framebufferWidth, framebufferHeight);
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

    const GLuint program = createProgram();
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

        if (gViewportHeight <= 0) {
            glfwPollEvents();
            continue;
        }
        const float aspect = static_cast<float>(gViewportWidth) / static_cast<float>(gViewportHeight);
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
