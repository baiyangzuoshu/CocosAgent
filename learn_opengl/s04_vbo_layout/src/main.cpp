#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;
constexpr GLsizei kFloat3Stride = 3 * static_cast<GLsizei>(sizeof(float));

struct Vertex {
    float position[3];
    float color[3];
};

enum class VertexLayout {
    Interleaved,
    Separate,
};

struct VertexBuffers {
    GLuint vertexArray = 0;
    GLuint interleaved = 0;
    GLuint positions = 0;
    GLuint colors = 0;
};

const Vertex kInterleavedVertices[] = {
    {{-0.65F, -0.55F, 0.0F}, {1.0F, 0.2F, 0.2F}},
    {{ 0.65F, -0.55F, 0.0F}, {0.2F, 1.0F, 0.3F}},
    {{ 0.00F,  0.65F, 0.0F}, {0.2F, 0.4F, 1.0F}},
};

const float kPositions[] = {
    -0.65F, -0.55F, 0.0F,
     0.65F, -0.55F, 0.0F,
     0.00F,  0.65F, 0.0F,
};

const float kColors[] = {
    1.0F, 0.2F, 0.2F,
    0.2F, 1.0F, 0.3F,
    0.2F, 0.4F, 1.0F,
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

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    glViewport(0, 0, width, height);
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

bool parseLayout(int argc, char** argv, VertexLayout* layout) {
    *layout = VertexLayout::Interleaved;
    if (argc == 1) {
        return true;
    }
    if (argc == 2 && std::string(argv[1]) == "--separate") {
        *layout = VertexLayout::Separate;
        return true;
    }
    if (argc == 2 && std::string(argv[1]) == "--interleaved") {
        return true;
    }
    return false;
}

VertexBuffers createVertexBuffers(VertexLayout layout) {
    VertexBuffers buffers;
    glGenVertexArrays(1, &buffers.vertexArray);
    glBindVertexArray(buffers.vertexArray);

    if (layout == VertexLayout::Interleaved) {
        glGenBuffers(1, &buffers.interleaved);
        glBindBuffer(GL_ARRAY_BUFFER, buffers.interleaved);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(sizeof(kInterleavedVertices)),
            kInterleavedVertices,
            GL_DYNAMIC_DRAW
        );

        const GLsizei stride = static_cast<GLsizei>(sizeof(Vertex));
        glVertexAttribPointer(
            0,
            3,
            GL_FLOAT,
            GL_FALSE,
            stride,
            reinterpret_cast<const void*>(offsetof(Vertex, position))
        );
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(
            1,
            3,
            GL_FLOAT,
            GL_FALSE,
            stride,
            reinterpret_cast<const void*>(offsetof(Vertex, color))
        );
        glEnableVertexAttribArray(1);
    } else {
        glGenBuffers(1, &buffers.positions);
        glBindBuffer(GL_ARRAY_BUFFER, buffers.positions);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(sizeof(kPositions)),
            kPositions,
            GL_DYNAMIC_DRAW
        );
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, kFloat3Stride, nullptr);
        glEnableVertexAttribArray(0);

        glGenBuffers(1, &buffers.colors);
        glBindBuffer(GL_ARRAY_BUFFER, buffers.colors);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(sizeof(kColors)),
            kColors,
            GL_DYNAMIC_DRAW
        );
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, kFloat3Stride, nullptr);
        glEnableVertexAttribArray(1);
    }

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    return buffers;
}

void updateApexPosition(const VertexBuffers& buffers, VertexLayout layout, float y) {
    const float newPosition[] = {0.0F, y, 0.0F};
    GLintptr byteOffset = 0;
    GLuint buffer = 0;

    if (layout == VertexLayout::Interleaved) {
        buffer = buffers.interleaved;
        byteOffset = static_cast<GLintptr>(
            2 * sizeof(Vertex) + offsetof(Vertex, position)
        );
    } else {
        buffer = buffers.positions;
        byteOffset = static_cast<GLintptr>(2 * 3 * sizeof(float));
    }

    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    glBufferSubData(
        GL_ARRAY_BUFFER,
        byteOffset,
        static_cast<GLsizeiptr>(sizeof(newPosition)),
        newPosition
    );
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

void deleteVertexBuffers(VertexBuffers* buffers) {
    if (buffers->colors != 0) {
        glDeleteBuffers(1, &buffers->colors);
    }
    if (buffers->positions != 0) {
        glDeleteBuffers(1, &buffers->positions);
    }
    if (buffers->interleaved != 0) {
        glDeleteBuffers(1, &buffers->interleaved);
    }
    if (buffers->vertexArray != 0) {
        glDeleteVertexArrays(1, &buffers->vertexArray);
    }
}

} // namespace

int main(int argc, char** argv) {
    VertexLayout layout = VertexLayout::Interleaved;
    if (!parseLayout(argc, argv, &layout)) {
        std::cerr << "Usage: learn_opengl_s04_vbo [--interleaved|--separate]\n";
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

    const char* windowTitle = layout == VertexLayout::Interleaved
        ? "Learn OpenGL - Interleaved VBO"
        : "Learn OpenGL - Separate VBOs";
    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        windowTitle,
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

    const GLuint program = createProgram();
    if (program == 0) {
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    VertexBuffers buffers = createVertexBuffers(layout);
    bool raised = false;
    bool spaceWasPressed = false;

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        const bool spaceIsPressed = glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS;
        if (spaceIsPressed && !spaceWasPressed) {
            raised = !raised;
            updateApexPosition(buffers, layout, raised ? 0.85F : 0.65F);
        }
        spaceWasPressed = spaceIsPressed;

        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(program);
        glBindVertexArray(buffers.vertexArray);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    deleteVertexBuffers(&buffers);
    glDeleteProgram(program);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
