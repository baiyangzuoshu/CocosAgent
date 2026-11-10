#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;

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

uniform mat4 uModel;
out vec3 vertexColor;

void main() {
    gl_Position = uModel * vec4(aPosition, 1.0);
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

Mat4 identityMatrix() {
    Mat4 result{};
    for (std::size_t index = 0; index < 4; ++index) {
        result.at(index, index) = 1.0F;
    }
    return result;
}

Mat4 translationMatrix(float x, float y, float z) {
    Mat4 result = identityMatrix();
    result.at(0, 3) = x;
    result.at(1, 3) = y;
    result.at(2, 3) = z;
    return result;
}

Mat4 scaleMatrix(float scale) {
    Mat4 result = identityMatrix();
    result.at(0, 0) = scale;
    result.at(1, 1) = scale;
    result.at(2, 2) = scale;
    return result;
}

Mat4 rotationZMatrix(float radians) {
    Mat4 result = identityMatrix();
    const float cosine = std::cos(radians);
    const float sine = std::sin(radians);
    result.at(0, 0) = cosine;
    result.at(0, 1) = -sine;
    result.at(1, 0) = sine;
    result.at(1, 1) = cosine;
    return result;
}

Mat4 multiply(const Mat4& left, const Mat4& right) {
    Mat4 result{};
    for (std::size_t row = 0; row < 4; ++row) {
        for (std::size_t column = 0; column < 4; ++column) {
            for (std::size_t inner = 0; inner < 4; ++inner) {
                result.at(row, column) += left.values[inner * 4 + row] * right.values[column * 4 + inner];
            }
        }
    }
    return result;
}

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    const int side = std::min(width, height);
    glViewport((width - side) / 2, (height - side) / 2, side, side);
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
        "Learn OpenGL - Model Matrix",
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

    const Vertex vertices[] = {
        { { -0.35F, -0.25F, 0.0F }, { 0.15F, 0.72F, 1.0F } },
        { {  0.35F, -0.25F, 0.0F }, { 1.0F, 0.38F, 0.18F } },
        { {  0.00F,  0.50F, 0.0F }, { 0.38F, 1.0F, 0.46F } },
        { {  0.00F,  0.00F, 0.0F }, { 1.0F, 1.0F, 1.0F } },
    };

    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);

    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
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

    const GLint modelLocation = glGetUniformLocation(program, "uModel");
    if (modelLocation < 0) {
        std::cerr << "Uniform uModel was not found in the linked program\n";
        glDeleteProgram(program);
        glDeleteBuffers(1, &vertexBuffer);
        glDeleteVertexArrays(1, &vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const Mat4 translation = translationMatrix(0.30F, -0.05F, 0.0F);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        const float time = static_cast<float>(glfwGetTime());
        const float angle = time;
        const float scale = 0.72F + 0.16F * std::sin(time * 1.5F);
        const Mat4 rotation = rotationZMatrix(angle);
        const Mat4 scaling = scaleMatrix(scale);
        const Mat4 model = multiply(translation, multiply(rotation, scaling));

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glBindVertexArray(vertexArray);

        glUniformMatrix4fv(modelLocation, 1, GL_FALSE, model.values.data());
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glUniformMatrix4fv(modelLocation, 1, GL_FALSE, translation.values.data());
        glPointSize(9.0F);
        glDrawArrays(GL_POINTS, 3, 1);

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
