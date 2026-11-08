#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;

enum class FailureMode {
    None,
    Compile,
    Link,
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
out vec3 vertexColor;

void main() {
    const vec2 positions[3] = vec2[3](
        vec2(-0.70, -0.60),
        vec2( 0.70, -0.60),
        vec2( 0.00,  0.70)
    );
    const vec3 colors[3] = vec3[3](
        vec3(1.0, 0.2, 0.2),
        vec3(0.2, 1.0, 0.3),
        vec3(0.2, 0.4, 1.0)
    );

    gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
    vertexColor = colors[gl_VertexID];
}
)glsl";

const char* kInvalidVertexShaderSource = R"glsl(
#version 330 core
void main() {
    gl_Position = vec4(1.0) + ;
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

const char* kMismatchedFragmentShaderSource = R"glsl(
#version 330 core
in vec2 vertexColor;
out vec4 fragmentColor;

void main() {
    fragmentColor = vec4(vertexColor, 0.0, 1.0);
}
)glsl";

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    glViewport(0, 0, width, height);
}

void printShaderLog(GLuint shader, const char* stageName) {
    GLint logLength = 0;
    glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &logLength);
    if (logLength <= 1) {
        return;
    }

    std::string log(static_cast<std::size_t>(logLength), '\0');
    GLsizei written = 0;
    glGetShaderInfoLog(shader, logLength, &written, log.data());
    log.resize(static_cast<std::size_t>(written));
    std::cerr << stageName << " shader log:\n" << log << '\n';
}

void printProgramLog(GLuint program) {
    GLint logLength = 0;
    glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
    if (logLength <= 1) {
        return;
    }

    std::string log(static_cast<std::size_t>(logLength), '\0');
    GLsizei written = 0;
    glGetProgramInfoLog(program, logLength, &written, log.data());
    log.resize(static_cast<std::size_t>(written));
    std::cerr << "Program link log:\n" << log << '\n';
}

GLuint compileShader(GLenum type, const char* stageName, const char* source) {
    const GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint compiled = GL_FALSE;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
    if (compiled == GL_FALSE) {
        std::cerr << stageName << " shader compilation failed\n";
        printShaderLog(shader, stageName);
        glDeleteShader(shader);
        return 0;
    }

    std::cout << stageName << " shader compilation succeeded\n";
    return shader;
}

GLuint createProgram(FailureMode failureMode) {
    const char* vertexSource = failureMode == FailureMode::Compile
        ? kInvalidVertexShaderSource
        : kVertexShaderSource;
    const char* fragmentSource = failureMode == FailureMode::Link
        ? kMismatchedFragmentShaderSource
        : kFragmentShaderSource;

    const GLuint vertexShader = compileShader(GL_VERTEX_SHADER, "Vertex", vertexSource);
    if (vertexShader == 0) {
        return 0;
    }

    const GLuint fragmentShader = compileShader(GL_FRAGMENT_SHADER, "Fragment", fragmentSource);
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
        std::cerr << "Program link failed\n";
        printProgramLog(program);
        glDeleteProgram(program);
        glDeleteShader(vertexShader);
        glDeleteShader(fragmentShader);
        return 0;
    }

    std::cout << "Program link succeeded\n";
    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);
    return program;
}

bool parseFailureMode(int argc, char** argv, FailureMode* failureMode) {
    *failureMode = FailureMode::None;
    if (argc == 1) {
        return true;
    }
    if (argc != 2) {
        return false;
    }

    const std::string option = argv[1];
    if (option == "--bad-compile") {
        *failureMode = FailureMode::Compile;
        return true;
    }
    if (option == "--bad-link") {
        *failureMode = FailureMode::Link;
        return true;
    }
    return false;
}

} // namespace

int main(int argc, char** argv) {
    FailureMode failureMode = FailureMode::None;
    if (!parseFailureMode(argc, argv, &failureMode)) {
        std::cerr << "Usage: learn_opengl_s02_shader [--bad-compile|--bad-link]\n";
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

    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        "Learn OpenGL - Shader Diagnostics",
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

    const GLuint program = createProgram(failureMode);
    if (program == 0) {
        glfwDestroyWindow(window);
        glfwTerminate();
        return 2;
    }

    // Core Profile 要求绑定 VAO；本课由 gl_VertexID 在 shader 中生成顶点。
    GLuint vertexArray = 0;
    glGenVertexArrays(1, &vertexArray);
    glBindVertexArray(vertexArray);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glDeleteVertexArrays(1, &vertexArray);
    glDeleteProgram(program);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
