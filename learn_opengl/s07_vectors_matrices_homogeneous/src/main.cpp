#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;

struct Vec4 {
    float x;
    float y;
    float z;
    float w;
};

struct Mat4 {
    std::array<float, 16> elements{};

    float& at(std::size_t row, std::size_t column) {
        return elements[column * 4 + row];
    }

    float at(std::size_t row, std::size_t column) const {
        return elements[column * 4 + row];
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

out vec3 vertexColor;

void main() {
    gl_Position = vec4(aPosition, 1.0);
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

Mat4 scaleMatrix(float x, float y, float z) {
    Mat4 result = identityMatrix();
    result.at(0, 0) = x;
    result.at(1, 1) = y;
    result.at(2, 2) = z;
    return result;
}

Mat4 rotationZ90Matrix() {
    Mat4 result = identityMatrix();
    result.at(0, 0) = 0.0F;
    result.at(0, 1) = -1.0F;
    result.at(1, 0) = 1.0F;
    result.at(1, 1) = 0.0F;
    return result;
}

Mat4 translationMatrix(float x, float y, float z) {
    Mat4 result = identityMatrix();
    result.at(0, 3) = x;
    result.at(1, 3) = y;
    result.at(2, 3) = z;
    return result;
}

Mat4 multiply(const Mat4& left, const Mat4& right) {
    Mat4 result{};
    for (std::size_t row = 0; row < 4; ++row) {
        for (std::size_t column = 0; column < 4; ++column) {
            for (std::size_t inner = 0; inner < 4; ++inner) {
                result.at(row, column) += left.at(row, inner) * right.at(inner, column);
            }
        }
    }
    return result;
}

Vec4 transform(const Mat4& matrix, const Vec4& vector) {
    const float input[4] = { vector.x, vector.y, vector.z, vector.w };
    float output[4] = {};
    for (std::size_t row = 0; row < 4; ++row) {
        for (std::size_t column = 0; column < 4; ++column) {
            output[row] += matrix.at(row, column) * input[column];
        }
    }
    return { output[0], output[1], output[2], output[3] };
}

void printVector(const char* label, const Vec4& vector) {
    std::cout << label << " = ("
              << vector.x << ", " << vector.y << ", "
              << vector.z << ", " << vector.w << ")\n";
}

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
    const Vec4 point{ 0.4F, 0.2F, 0.0F, 1.0F };
    const Vec4 direction{ 0.4F, 0.2F, 0.0F, 0.0F };
    const Mat4 scale = scaleMatrix(1.5F, 1.0F, 1.0F);
    const Mat4 rotation = rotationZ90Matrix();
    const Mat4 translation = translationMatrix(0.3F, -0.1F, 0.0F);
    const Mat4 transformMatrix = multiply(translation, multiply(rotation, scale));

    const Vec4 afterScale = transform(scale, point);
    const Vec4 afterRotation = transform(rotation, afterScale);
    const Vec4 transformedPoint = transform(translation, afterRotation);
    const Vec4 transformedDirection = transform(transformMatrix, direction);

    std::cout << std::fixed << std::setprecision(2);
    printVector("point", point);
    printVector("S * point", afterScale);
    printVector("R * S * point", afterRotation);
    printVector("T * R * S * point", transformedPoint);
    printVector("T * R * S * direction", transformedDirection);

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
        "Learn OpenGL - Vectors and Homogeneous Coordinates",
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
    const std::array<float, 3> axisColor{ 0.52F, 0.55F, 0.60F };
    const std::array<float, 3> connectorColor{ 0.78F, 0.78F, 0.72F };
    const std::array<float, 3> pointColor{ 0.10F, 0.82F, 1.0F };
    const std::array<float, 3> transformedColor{ 1.0F, 0.38F, 0.14F };

    std::vector<Vertex> vertices;
    for (int step = -8; step <= 8; ++step) {
        if (step == 0) {
            continue;
        }
        const float coordinate = static_cast<float>(step) / 8.0F;
        addLine(vertices, coordinate, -1.0F, coordinate, 1.0F, gridColor);
        addLine(vertices, -1.0F, coordinate, 1.0F, coordinate, gridColor);
    }
    const GLsizei gridVertexCount = static_cast<GLsizei>(vertices.size());

    addLine(vertices, -1.0F, 0.0F, 1.0F, 0.0F, axisColor);
    addLine(vertices, 0.0F, -1.0F, 0.0F, 1.0F, axisColor);
    const GLint axisStart = gridVertexCount;
    const GLsizei axisVertexCount = static_cast<GLsizei>(vertices.size()) - gridVertexCount;

    const GLint connectorStart = static_cast<GLint>(vertices.size());
    addLine(vertices, point.x, point.y, transformedPoint.x, transformedPoint.y, connectorColor);

    const GLint pointsStart = static_cast<GLint>(vertices.size());
    vertices.push_back(makeVertex(point.x, point.y, pointColor));
    vertices.push_back(makeVertex(transformedPoint.x, transformedPoint.y, transformedColor));

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

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glBindVertexArray(vertexArray);
        glDrawArrays(GL_LINES, 0, gridVertexCount);
        glDrawArrays(GL_LINES, axisStart, axisVertexCount);
        glDrawArrays(GL_LINES, connectorStart, 2);
        glPointSize(14.0F);
        glDrawArrays(GL_POINTS, pointsStart, 2);

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
