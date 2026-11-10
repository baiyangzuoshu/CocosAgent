#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 800;
constexpr int kWindowHeight = 600;
constexpr int kTextureWidth = 4;
constexpr int kTextureHeight = 4;

struct Vertex {
    float position[2];
    float texCoord[2];
};

enum class WrapMode {
    Repeat,
    ClampToEdge,
};

enum class FilterMode {
    Nearest,
    Linear,
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec2 aTexCoord;

uniform float uAspect;
uniform float uSize;
out vec2 textureCoord;

void main() {
    vec2 clipPosition = aPosition * vec2(uSize / uAspect, uSize);
    gl_Position = vec4(clipPosition, 0.0, 1.0);
    textureCoord = aTexCoord;
}
)glsl";

const char* kFragmentShaderSource = R"glsl(
#version 330 core
in vec2 textureCoord;
uniform sampler2D uTexture;
out vec4 fragmentColor;

void main() {
    fragmentColor = texture(uTexture, textureCoord);
}
)glsl";

float gAspect = static_cast<float>(kWindowWidth) / static_cast<float>(kWindowHeight);
bool gDrawable = true;
WrapMode gWrapMode = WrapMode::Repeat;
FilterMode gFilterMode = FilterMode::Nearest;
GLuint gTexture = 0;

std::array<unsigned char, kTextureWidth * kTextureHeight * 4> makePatternPixels() {
    std::array<unsigned char, kTextureWidth * kTextureHeight * 4> pixels{};
    const std::array<unsigned char, 4> dark{ 24, 36, 58, 255 };
    const std::array<unsigned char, 4> light{ 236, 220, 154, 255 };
    const std::array<std::array<unsigned char, 4>, 4> cornerColors{{
        { 35, 110, 240, 255 },
        { 250, 205, 40, 255 },
        { 235, 55, 65, 255 },
        { 45, 205, 115, 255 },
    }};

    for (int y = 0; y < kTextureHeight; ++y) {
        for (int x = 0; x < kTextureWidth; ++x) {
            std::array<unsigned char, 4> color = ((x + y) % 2 == 0) ? dark : light;
            if (x == 0 && y == 0) {
                color = cornerColors[0]; // bottom-left
            } else if (x == kTextureWidth - 1 && y == 0) {
                color = cornerColors[1]; // bottom-right
            } else if (x == 0 && y == kTextureHeight - 1) {
                color = cornerColors[2]; // top-left
            } else if (x == kTextureWidth - 1 && y == kTextureHeight - 1) {
                color = cornerColors[3]; // top-right
            }

            const std::size_t offset = static_cast<std::size_t>(
                (y * kTextureWidth + x) * 4
            );
            for (std::size_t channel = 0; channel < color.size(); ++channel) {
                pixels[offset + channel] = color[channel];
            }
        }
    }

    return pixels;
}

void applySamplerParameters() {
    if (gTexture == 0) {
        return;
    }

    const GLint wrap = static_cast<GLint>(
        gWrapMode == WrapMode::Repeat ? GL_REPEAT : GL_CLAMP_TO_EDGE
    );
    const GLint filter = static_cast<GLint>(
        gFilterMode == FilterMode::Nearest ? GL_NEAREST : GL_LINEAR
    );

    glBindTexture(GL_TEXTURE_2D, gTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrap);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
    glBindTexture(GL_TEXTURE_2D, 0);
}

void updateWindowTitle(GLFWwindow* window) {
    const char* wrap = gWrapMode == WrapMode::Repeat ? "Repeat" : "Clamp to edge";
    const char* filter = gFilterMode == FilterMode::Nearest ? "Nearest" : "Linear";
    const std::string title = std::string("Learn OpenGL - ") + wrap + " / " + filter;
    glfwSetWindowTitle(window, title.c_str());
}

void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    if (width <= 0 || height <= 0) {
        gDrawable = false;
        return;
    }

    gDrawable = true;
    gAspect = static_cast<float>(width) / static_cast<float>(height);
    glViewport(0, 0, width, height);
}

void keyCallback(GLFWwindow* window, int key, int, int action, int) {
    if (action != GLFW_PRESS) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
        return;
    }

    switch (key) {
        case GLFW_KEY_R:
            gWrapMode = WrapMode::Repeat;
            break;
        case GLFW_KEY_C:
            gWrapMode = WrapMode::ClampToEdge;
            break;
        case GLFW_KEY_N:
            gFilterMode = FilterMode::Nearest;
            break;
        case GLFW_KEY_L:
            gFilterMode = FilterMode::Linear;
            break;
        default:
            return;
    }

    applySamplerParameters();
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

void releaseResources(GLuint program, GLuint texture, GLuint vertexBuffer, GLuint vertexArray) {
    if (program != 0) {
        glDeleteProgram(program);
    }
    if (texture != 0) {
        glDeleteTextures(1, &texture);
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
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif

    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        "Learn OpenGL - Repeat / Nearest",
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

    // UVs extend beyond [0, 1] so the sampler address modes affect visible pixels.
    constexpr std::array<Vertex, 4> vertices{{
        { { -1.0F, -1.0F }, { -0.5F, -0.5F } },
        { {  1.0F, -1.0F }, {  1.5F, -0.5F } },
        { { -1.0F,  1.0F }, { -0.5F,  1.5F } },
        { {  1.0F,  1.0F }, {  1.5F,  1.5F } },
    }};
    const auto pixels = makePatternPixels();

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
    glVertexAttribPointer(
        1,
        2,
        GL_FLOAT,
        GL_FALSE,
        static_cast<GLsizei>(sizeof(Vertex)),
        reinterpret_cast<const void*>(offsetof(Vertex, texCoord))
    );
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    GLuint texture = 0;
    glGenTextures(1, &texture);
    gTexture = texture;
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, texture);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexImage2D(
        GL_TEXTURE_2D,
        0,
        GL_RGBA8,
        kTextureWidth,
        kTextureHeight,
        0,
        GL_RGBA,
        GL_UNSIGNED_BYTE,
        pixels.data()
    );
    applySamplerParameters();
    glBindTexture(GL_TEXTURE_2D, 0);

    const GLuint program = createProgram();
    if (program == 0) {
        releaseResources(0, texture, vertexBuffer, vertexArray);
        gTexture = 0;
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const GLint textureLocation = glGetUniformLocation(program, "uTexture");
    const GLint aspectLocation = glGetUniformLocation(program, "uAspect");
    const GLint sizeLocation = glGetUniformLocation(program, "uSize");
    if (textureLocation < 0 || aspectLocation < 0 || sizeLocation < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, texture, vertexBuffer, vertexArray);
        gTexture = 0;
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    glUniform1i(textureLocation, 0);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const float size = std::min(0.90F, 0.90F * gAspect);
            glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);
            glUseProgram(program);
            glUniform1f(aspectLocation, gAspect);
            glUniform1f(sizeLocation, size);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, texture);
            glBindVertexArray(vertexArray);
            glDrawArrays(GL_TRIANGLE_STRIP, 0, static_cast<GLsizei>(vertices.size()));
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, texture, vertexBuffer, vertexArray);
    gTexture = 0;
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
