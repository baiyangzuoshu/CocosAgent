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
constexpr int kWindowHeight = 600;
constexpr int kTextureSize = 64;

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
uniform float uRepeatCount;
uniform float uOffset;
out vec2 textureCoord;

void main() {
    vec2 clipPosition = aPosition * vec2(uSize / uAspect, uSize);
    gl_Position = vec4(clipPosition, 0.0, 1.0);
    textureCoord = aTexCoord * uRepeatCount + vec2(uOffset, 0.0);
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

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
int gRepeatCount = 32;
bool gDrawable = false;

std::array<unsigned char, kTextureSize * kTextureSize * 4> makeCheckerPixels() {
    std::array<unsigned char, kTextureSize * kTextureSize * 4> pixels{};
    for (int y = 0; y < kTextureSize; ++y) {
        for (int x = 0; x < kTextureSize; ++x) {
            const unsigned char value = ((x + y) % 2 == 0) ? 245 : 10;
            const std::size_t offset = static_cast<std::size_t>(
                (y * kTextureSize + x) * 4
            );
            pixels[offset + 0] = value;
            pixels[offset + 1] = value;
            pixels[offset + 2] = value;
            pixels[offset + 3] = 255;
        }
    }
    return pixels;
}

GLuint createCheckerTexture(const unsigned char* pixels, bool generateMipmaps) {
    GLuint texture = 0;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(
        GL_TEXTURE_2D,
        GL_TEXTURE_MIN_FILTER,
        generateMipmaps ? GL_LINEAR_MIPMAP_LINEAR : GL_LINEAR
    );
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
    if (generateMipmaps) {
        glGenerateMipmap(GL_TEXTURE_2D);
    }
    glBindTexture(GL_TEXTURE_2D, 0);
    return texture;
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = "Learn OpenGL - Left: base only / Right: mipmaps / repeats: "
        + std::to_string(gRepeatCount);
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
    if (action != GLFW_PRESS) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
        return;
    }

    if (key == GLFW_KEY_UP) {
        gRepeatCount = std::min(gRepeatCount + 4, 64);
    } else if (key == GLFW_KEY_DOWN) {
        gRepeatCount = std::max(gRepeatCount - 4, 4);
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

void drawPanel(
    GLuint texture,
    int x,
    int width,
    int height,
    GLint aspectLocation,
    GLint sizeLocation,
    GLuint vertexArray
) {
    const float aspect = static_cast<float>(width) / static_cast<float>(height);
    const float size = std::min(0.90F, 0.90F * aspect);
    glViewport(x, 0, width, height);
    glBindTexture(GL_TEXTURE_2D, texture);
    glUniform1f(aspectLocation, aspect);
    glUniform1f(sizeLocation, size);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}

void releaseResources(GLuint program, GLuint baseTexture, GLuint mipTexture, GLuint vertexBuffer, GLuint vertexArray) {
    if (program != 0) {
        glDeleteProgram(program);
    }
    if (baseTexture != 0) {
        glDeleteTextures(1, &baseTexture);
    }
    if (mipTexture != 0) {
        glDeleteTextures(1, &mipTexture);
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
        "Learn OpenGL - Left: base only / Right: mipmaps",
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
    const auto pixels = makeCheckerPixels();

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

    const GLuint baseTexture = createCheckerTexture(pixels.data(), false);
    const GLuint mipTexture = createCheckerTexture(pixels.data(), true);
    const GLuint program = createProgram();
    if (program == 0) {
        releaseResources(0, baseTexture, mipTexture, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const GLint textureLocation = glGetUniformLocation(program, "uTexture");
    const GLint aspectLocation = glGetUniformLocation(program, "uAspect");
    const GLint sizeLocation = glGetUniformLocation(program, "uSize");
    const GLint repeatCountLocation = glGetUniformLocation(program, "uRepeatCount");
    const GLint offsetLocation = glGetUniformLocation(program, "uOffset");
    if (textureLocation < 0 || aspectLocation < 0 || sizeLocation < 0
        || repeatCountLocation < 0 || offsetLocation < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, baseTexture, mipTexture, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    glUniform1i(textureLocation, 0);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const int leftWidth = gFramebufferWidth / 2;
            const int rightWidth = gFramebufferWidth - leftWidth;
            const float time = static_cast<float>(glfwGetTime());
            const float offset = 0.02F * std::sin(time * 1.1F);

            glClearColor(0.06F, 0.07F, 0.10F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);
            glUseProgram(program);
            glUniform1f(repeatCountLocation, static_cast<float>(gRepeatCount));
            glUniform1f(offsetLocation, offset);
            glActiveTexture(GL_TEXTURE0);
            drawPanel(baseTexture, 0, leftWidth, gFramebufferHeight, aspectLocation, sizeLocation, vertexArray);
            drawPanel(mipTexture, leftWidth, rightWidth, gFramebufferHeight, aspectLocation, sizeLocation, vertexArray);
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, baseTexture, mipTexture, vertexBuffer, vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
