#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <string>

namespace {

constexpr int kWindowWidth = 900;
constexpr int kWindowHeight = 600;
constexpr int kTextureSize = 8;

struct Vertex {
    float position[2];
    float texCoord[2];
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
uniform sampler2D uTextureA;
uniform sampler2D uTextureB;
uniform float uMixFactor;
out vec4 fragmentColor;

void main() {
    vec4 colorA = texture(uTextureA, textureCoord);
    vec4 colorB = texture(uTextureB, textureCoord);
    fragmentColor = mix(colorA, colorB, uMixFactor);
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
float gMixFactor = 0.5F;
bool gDrawable = false;

std::array<unsigned char, kTextureSize * kTextureSize * 4> makeCoolPatternPixels() {
    std::array<unsigned char, kTextureSize * kTextureSize * 4> pixels{};
    constexpr std::array<unsigned char, 4> kBlue{ 30, 90, 220, 255 };
    constexpr std::array<unsigned char, 4> kCyan{ 35, 210, 190, 255 };

    for (int y = 0; y < kTextureSize; ++y) {
        for (int x = 0; x < kTextureSize; ++x) {
            const auto& color = ((x / 2 + y / 2) % 2 == 0) ? kBlue : kCyan;
            const std::size_t offset = static_cast<std::size_t>(
                (y * kTextureSize + x) * 4
            );
            for (std::size_t channel = 0; channel < color.size(); ++channel) {
                pixels[offset + channel] = color[channel];
            }
        }
    }

    return pixels;
}

std::array<unsigned char, kTextureSize * kTextureSize * 4> makeWarmPatternPixels() {
    std::array<unsigned char, kTextureSize * kTextureSize * 4> pixels{};
    constexpr std::array<std::array<unsigned char, 4>, 3> kPalette{{
        { 245, 195, 45, 255 },
        { 240, 105, 35, 255 },
        { 190, 45, 90, 255 },
    }};

    for (int y = 0; y < kTextureSize; ++y) {
        for (int x = 0; x < kTextureSize; ++x) {
            const std::size_t paletteIndex = static_cast<std::size_t>(((x + y) / 3) % 3);
            const auto& color = kPalette[paletteIndex];
            const std::size_t offset = static_cast<std::size_t>(
                (y * kTextureSize + x) * 4
            );
            for (std::size_t channel = 0; channel < color.size(); ++channel) {
                pixels[offset + channel] = color[channel];
            }
        }
    }

    return pixels;
}

GLuint createTexture(const unsigned char* pixels) {
    GLuint texture = 0;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexImage2D(
        GL_TEXTURE_2D,
        0,
        GL_RGBA8,
        kTextureSize,
        kTextureSize,
        0,
        GL_RGBA,
        GL_UNSIGNED_BYTE,
        pixels
    );
    glBindTexture(GL_TEXTURE_2D, 0);
    return texture;
}

void updateWindowTitle(GLFWwindow* window) {
    const int percentage = static_cast<int>(std::lround(gMixFactor * 100.0F));
    const std::string title = "Learn OpenGL - Texture A/B mix: "
        + std::to_string(percentage) + "%  (Left/Right, 1/2/3)";
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
    if (action != GLFW_PRESS && action != GLFW_REPEAT) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
        return;
    }

    if (key == GLFW_KEY_1) {
        gMixFactor = 0.0F;
    } else if (key == GLFW_KEY_2) {
        gMixFactor = 1.0F;
    } else if (key == GLFW_KEY_3) {
        gMixFactor = 0.5F;
    } else if (key == GLFW_KEY_LEFT) {
        gMixFactor = std::max(0.0F, gMixFactor - 0.1F);
    } else if (key == GLFW_KEY_RIGHT) {
        gMixFactor = std::min(1.0F, gMixFactor + 0.1F);
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

void releaseResources(
    GLuint program,
    GLuint textureA,
    GLuint textureB,
    GLuint vertexBuffer,
    GLuint vertexArray
) {
    if (program != 0) {
        glDeleteProgram(program);
    }
    if (textureA != 0) {
        glDeleteTextures(1, &textureA);
    }
    if (textureB != 0) {
        glDeleteTextures(1, &textureB);
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
        "Learn OpenGL - Texture A/B mix: 50%",
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

    constexpr std::array<Vertex, 4> vertices{{
        { { -1.0F, -1.0F }, { 0.0F, 0.0F } },
        { {  1.0F, -1.0F }, { 1.0F, 0.0F } },
        { { -1.0F,  1.0F }, { 0.0F, 1.0F } },
        { {  1.0F,  1.0F }, { 1.0F, 1.0F } },
    }};
    const auto coolPixels = makeCoolPatternPixels();
    const auto warmPixels = makeWarmPatternPixels();

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

    const GLuint textureA = createTexture(coolPixels.data());
    const GLuint textureB = createTexture(warmPixels.data());
    const GLuint program = createProgram();
    if (program == 0) {
        releaseResources(0, textureA, textureB, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const GLint textureALocation = glGetUniformLocation(program, "uTextureA");
    const GLint textureBLocation = glGetUniformLocation(program, "uTextureB");
    const GLint mixFactorLocation = glGetUniformLocation(program, "uMixFactor");
    const GLint aspectLocation = glGetUniformLocation(program, "uAspect");
    const GLint sizeLocation = glGetUniformLocation(program, "uSize");
    if (textureALocation < 0 || textureBLocation < 0 || mixFactorLocation < 0
        || aspectLocation < 0 || sizeLocation < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, textureA, textureB, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    glUniform1i(textureALocation, 0);
    glUniform1i(textureBLocation, 1);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const float aspect = static_cast<float>(gFramebufferWidth)
                / static_cast<float>(gFramebufferHeight);
            const float size = std::min(0.86F, 0.86F * aspect);

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);

            glUseProgram(program);
            glUniform1f(aspectLocation, aspect);
            glUniform1f(sizeLocation, size);
            glUniform1f(mixFactorLocation, gMixFactor);

            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, textureA);
            glActiveTexture(GL_TEXTURE1);
            glBindTexture(GL_TEXTURE_2D, textureB);

            glBindVertexArray(vertexArray);
            glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, textureA, textureB, vertexBuffer, vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
