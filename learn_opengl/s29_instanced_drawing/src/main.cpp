#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <iostream>
#include <sstream>
#include <vector>

namespace {

constexpr int kWindowWidth = 1180;
constexpr int kWindowHeight = 820;
constexpr int kColumns = 32;
constexpr int kRows = 20;
constexpr int kInstanceCount = kColumns * kRows;
constexpr float kSceneAspect = 3.0F / 2.0F;

struct Vertex {
    float position[2];
};

struct InstanceData {
    float offset[2];
    float scale[2];
    float color[3];
};

struct Mesh {
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    GLuint indexBuffer = 0;
    GLuint instanceBuffer = 0;
};

struct Uniforms {
    GLint aspect = -1;
    GLint useInstanceData = -1;
    GLint offset = -1;
    GLint scale = -1;
    GLint color = -1;
};

const char* kVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec2 aInstanceOffset;
layout (location = 2) in vec2 aInstanceScale;
layout (location = 3) in vec3 aInstanceColor;

uniform float uAspect;
uniform bool uUseInstanceData;
uniform vec2 uOffset;
uniform vec2 uScale;
uniform vec3 uColor;

out vec3 vColor;

void main() {
    vec2 offset = uUseInstanceData ? aInstanceOffset : uOffset;
    vec2 scale = uUseInstanceData ? aInstanceScale : uScale;
    vColor = uUseInstanceData ? aInstanceColor : uColor;
    vec2 position = aPosition * scale + offset;
    gl_Position = vec4(position.x / uAspect, position.y, 0.0, 1.0);
}
)glsl";

const char* kFragmentShader = R"glsl(
#version 330 core
in vec3 vColor;
out vec4 fragmentColor;

void main() {
    fragmentColor = vec4(vColor, 1.0);
}
)glsl";

int gWindowWidth = 0;
int gWindowHeight = 0;
bool gDrawable = false;
bool gInstanced = true;

Uniforms getUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uAspect"),
        glGetUniformLocation(program, "uUseInstanceData"),
        glGetUniformLocation(program, "uOffset"),
        glGetUniformLocation(program, "uScale"),
        glGetUniformLocation(program, "uColor"),
    };
}

bool hasRequiredUniforms(const Uniforms& uniforms) {
    return uniforms.aspect >= 0
        && uniforms.useInstanceData >= 0
        && uniforms.offset >= 0
        && uniforms.scale >= 0
        && uniforms.color >= 0;
}

void updateWindowTitle(GLFWwindow* window) {
    std::ostringstream title;
    title << "Learn OpenGL - Instanced Drawing | "
          << (gInstanced ? "instanced" : "per-object")
          << " | objects " << kInstanceCount
          << " | draw calls " << (gInstanced ? 1 : kInstanceCount)
          << " (1 per-object, 2 instanced, R reset)";
    glfwSetWindowTitle(window, title.str().c_str());
}

void framebufferSizeCallback(GLFWwindow* window, int width, int height) {
    gWindowWidth = width;
    gWindowHeight = height;
    gDrawable = width > 0 && height > 0;
    updateWindowTitle(window);
}

void keyCallback(GLFWwindow* window, int key, int, int action, int) {
    if (action != GLFW_PRESS) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    } else if (key == GLFW_KEY_1) {
        gInstanced = false;
        updateWindowTitle(window);
    } else if (key == GLFW_KEY_2 || key == GLFW_KEY_R) {
        gInstanced = true;
        updateWindowTitle(window);
    }
}

std::vector<InstanceData> makeInstances() {
    const std::array<std::array<float, 3>, 8> palette = {{
        {{ 0.18F, 0.72F, 0.95F }},
        {{ 0.34F, 0.86F, 0.64F }},
        {{ 0.94F, 0.70F, 0.22F }},
        {{ 0.96F, 0.38F, 0.34F }},
        {{ 0.80F, 0.40F, 0.88F }},
        {{ 0.30F, 0.54F, 0.96F }},
        {{ 0.96F, 0.48F, 0.68F }},
        {{ 0.48F, 0.84F, 0.90F }},
    }};

    const float stepX = 2.46F / static_cast<float>(kColumns);
    const float stepY = 1.50F / static_cast<float>(kRows);
    std::vector<InstanceData> instances;
    instances.reserve(kInstanceCount);

    for (int row = 0; row < kRows; ++row) {
        for (int column = 0; column < kColumns; ++column) {
            const int colorIndex = (column * 3 + row * 5 + column / 4) % static_cast<int>(palette.size());
            const float shade = 0.72F + 0.28F * static_cast<float>((row + column) % 4) / 3.0F;
            const auto& baseColor = palette[static_cast<std::size_t>(colorIndex)];
            const float x = -1.23F + (static_cast<float>(column) + 0.5F) * stepX;
            const float y = -0.75F + (static_cast<float>(row) + 0.5F) * stepY;
            instances.push_back({
                { x, y },
                { stepX * 0.76F, stepY * 0.76F },
                { baseColor[0] * shade, baseColor[1] * shade, baseColor[2] * shade },
            });
        }
    }
    return instances;
}

void createMesh(
    const std::array<Vertex, 4>& vertices,
    const std::array<unsigned int, 6>& indices,
    const std::vector<InstanceData>& instances,
    Mesh& mesh
) {
    glGenVertexArrays(1, &mesh.vertexArray);
    glGenBuffers(1, &mesh.vertexBuffer);
    glGenBuffers(1, &mesh.indexBuffer);
    glGenBuffers(1, &mesh.instanceBuffer);

    glBindVertexArray(mesh.vertexArray);

    glBindBuffer(GL_ARRAY_BUFFER, mesh.vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), nullptr);
    glEnableVertexAttribArray(0);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices.data(), GL_STATIC_DRAW);

    glBindBuffer(GL_ARRAY_BUFFER, mesh.instanceBuffer);
    glBufferData(GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(instances.size() * sizeof(InstanceData)), instances.data(), GL_STATIC_DRAW);

    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(InstanceData),
        reinterpret_cast<const void*>(offsetof(InstanceData, offset)));
    glEnableVertexAttribArray(1);
    glVertexAttribDivisor(1, 1);

    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(InstanceData),
        reinterpret_cast<const void*>(offsetof(InstanceData, scale)));
    glEnableVertexAttribArray(2);
    glVertexAttribDivisor(2, 1);

    glVertexAttribPointer(3, 3, GL_FLOAT, GL_FALSE, sizeof(InstanceData),
        reinterpret_cast<const void*>(offsetof(InstanceData, color)));
    glEnableVertexAttribArray(3);
    glVertexAttribDivisor(3, 1);

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

void letterboxViewport(int windowWidth, int windowHeight, int& x, int& y, int& width, int& height) {
    const float windowAspect = static_cast<float>(windowWidth) / static_cast<float>(windowHeight);
    if (windowAspect > kSceneAspect) {
        height = windowHeight;
        width = std::max(1, static_cast<int>(static_cast<float>(height) * kSceneAspect));
        x = (windowWidth - width) / 2;
        y = 0;
    } else {
        width = windowWidth;
        height = std::max(1, static_cast<int>(static_cast<float>(width) / kSceneAspect));
        x = 0;
        y = (windowHeight - height) / 2;
    }
}

void drawPerObject(
    const Uniforms& uniforms,
    const std::vector<InstanceData>& instances,
    const Mesh& mesh
) {
    glUniform1i(uniforms.useInstanceData, GL_FALSE);
    glBindVertexArray(mesh.vertexArray);
    for (const InstanceData& instance : instances) {
        glUniform2f(uniforms.offset, instance.offset[0], instance.offset[1]);
        glUniform2f(uniforms.scale, instance.scale[0], instance.scale[1]);
        glUniform3f(uniforms.color, instance.color[0], instance.color[1], instance.color[2]);
        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, nullptr);
    }
}

void drawInstanced(const Uniforms& uniforms, const Mesh& mesh) {
    glUniform1i(uniforms.useInstanceData, GL_TRUE);
    glBindVertexArray(mesh.vertexArray);
    glDrawElementsInstanced(GL_TRIANGLES, 6, GL_UNSIGNED_INT, nullptr, kInstanceCount);
}

void releaseResources(GLuint program, const Mesh& mesh) {
    if (program != 0) glDeleteProgram(program);
    if (mesh.vertexArray != 0) glDeleteVertexArrays(1, &mesh.vertexArray);
    if (mesh.vertexBuffer != 0) glDeleteBuffers(1, &mesh.vertexBuffer);
    if (mesh.indexBuffer != 0) glDeleteBuffers(1, &mesh.indexBuffer);
    if (mesh.instanceBuffer != 0) glDeleteBuffers(1, &mesh.instanceBuffer);
}

GLuint compileShader(GLenum type, const char* source) {
    const GLuint shader = glCreateShader(type);
    if (shader == 0) {
        std::cerr << "Failed to create shader\n";
        return 0;
    }
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint compiled = GL_FALSE;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
    if (compiled == GL_FALSE) {
        GLint logLength = 0;
        glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &logLength);
        if (logLength > 1) {
            std::vector<char> log(static_cast<std::size_t>(logLength), '\0');
            GLsizei written = 0;
            glGetShaderInfoLog(shader, logLength, &written, log.data());
            std::cerr << "Shader compilation failed:\n" << log.data() << '\n';
        }
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

GLuint createProgram(const char* vertexSource, const char* fragmentSource) {
    const GLuint vertexShader = compileShader(GL_VERTEX_SHADER, vertexSource);
    if (vertexShader == 0) return 0;
    const GLuint fragmentShader = compileShader(GL_FRAGMENT_SHADER, fragmentSource);
    if (fragmentShader == 0) {
        glDeleteShader(vertexShader);
        return 0;
    }

    const GLuint program = glCreateProgram();
    if (program == 0) {
        glDeleteShader(vertexShader);
        glDeleteShader(fragmentShader);
        return 0;
    }
    glAttachShader(program, vertexShader);
    glAttachShader(program, fragmentShader);
    glLinkProgram(program);

    GLint linked = GL_FALSE;
    glGetProgramiv(program, GL_LINK_STATUS, &linked);
    if (linked == GL_FALSE) {
        GLint logLength = 0;
        glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
        if (logLength > 1) {
            std::vector<char> log(static_cast<std::size_t>(logLength), '\0');
            GLsizei written = 0;
            glGetProgramInfoLog(program, logLength, &written, log.data());
            std::cerr << "Program link failed:\n" << log.data() << '\n';
        }
        glDeleteProgram(program);
        glDeleteShader(vertexShader);
        glDeleteShader(fragmentShader);
        return 0;
    }

    glDetachShader(program, vertexShader);
    glDetachShader(program, fragmentShader);
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

    GLFWwindow* window = glfwCreateWindow(kWindowWidth, kWindowHeight,
        "Learn OpenGL - Instanced Drawing", nullptr, nullptr);
    if (window == nullptr) {
        std::cerr << "Failed to create GLFW window\n";
        glfwTerminate();
        return 1;
    }
    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);

    if (gladLoadGLLoader(reinterpret_cast<GLADloadproc>(glfwGetProcAddress)) == 0) {
        std::cerr << "Failed to load OpenGL functions\n";
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glfwSetKeyCallback(window, keyCallback);
    glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
    glfwGetFramebufferSize(window, &gWindowWidth, &gWindowHeight);
    gDrawable = gWindowWidth > 0 && gWindowHeight > 0;
    updateWindowTitle(window);

    const GLuint program = createProgram(kVertexShader, kFragmentShader);
    const std::array<Vertex, 4> vertices = {{
        { { -0.5F, -0.5F } },
        { {  0.5F, -0.5F } },
        { {  0.5F,  0.5F } },
        { { -0.5F,  0.5F } },
    }};
    const std::array<unsigned int, 6> indices = {{ 0, 1, 2, 0, 2, 3 }};
    const std::vector<InstanceData> instances = makeInstances();
    Mesh mesh;
    createMesh(vertices, indices, instances, mesh);

    if (program == 0) {
        releaseResources(program, mesh);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const Uniforms uniforms = getUniforms(program);
    if (!hasRequiredUniforms(uniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, mesh);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glDisable(GL_DEPTH_TEST);
    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            glBindFramebuffer(GL_FRAMEBUFFER, 0);
            glViewport(0, 0, gWindowWidth, gWindowHeight);
            glClearColor(0.035F, 0.045F, 0.075F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);

            int viewX = 0;
            int viewY = 0;
            int viewWidth = 0;
            int viewHeight = 0;
            letterboxViewport(gWindowWidth, gWindowHeight, viewX, viewY, viewWidth, viewHeight);
            glViewport(viewX, viewY, viewWidth, viewHeight);
            glUseProgram(program);
            glUniform1f(uniforms.aspect, kSceneAspect);
            if (gInstanced) {
                drawInstanced(uniforms, mesh);
            } else {
                drawPerObject(uniforms, instances, mesh);
            }
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, mesh);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
