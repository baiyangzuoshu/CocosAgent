#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {

constexpr int kWindowWidth = 1100;
constexpr int kWindowHeight = 760;
constexpr int kRenderWidth = 768;
constexpr int kRenderHeight = 512;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kCubeHalfExtent = 0.82F;

struct SceneVertex {
    float position[3];
    float color[3];
};

struct ScreenVertex {
    float position[2];
    float uv[2];
};

struct RenderTarget {
    GLuint framebuffer = 0;
    GLuint colorTexture = 0;
    GLuint depthStencil = 0;
};

struct SceneUniforms {
    GLint angle = -1;
    GLint aspect = -1;
};

struct DisplayUniforms {
    GLint sceneTexture = -1;
    GLint grayscale = -1;
};

const char* kSceneVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aColor;

uniform float uAngle;
uniform float uAspect;
out vec3 vColor;

void main() {
    float cy = cos(uAngle);
    float sy = sin(uAngle);
    float cx = cos(uAngle * 0.71);
    float sx = sin(uAngle * 0.71);

    vec3 rotatedY = vec3(
        cy * aPosition.x + sy * aPosition.z,
        aPosition.y,
        -sy * aPosition.x + cy * aPosition.z
    );
    vec3 rotated = vec3(
        rotatedY.x,
        cx * rotatedY.y - sx * rotatedY.z,
        sx * rotatedY.y + cx * rotatedY.z
    );

    const float nearPlane = 0.1;
    const float farPlane = 10.0;
    float depth = 3.2 - rotated.z;
    float clipZ = ((farPlane + nearPlane) / (farPlane - nearPlane)) * depth
        - ((2.0 * farPlane * nearPlane) / (farPlane - nearPlane));

    gl_Position = vec4(
        rotated.x * 1.45 / uAspect,
        rotated.y * 1.45,
        clipZ,
        depth
    );
    vColor = aColor;
}
)glsl";

const char* kSceneFragmentShader = R"glsl(
#version 330 core
in vec3 vColor;
out vec4 fragmentColor;

void main() {
    fragmentColor = vec4(vColor, 1.0);
}
)glsl";

const char* kDisplayVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec2 aUV;
out vec2 vUV;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aUV;
}
)glsl";

const char* kDisplayFragmentShader = R"glsl(
#version 330 core
in vec2 vUV;
uniform sampler2D uSceneTexture;
uniform int uGrayscale;
out vec4 fragmentColor;

void main() {
    vec3 color = texture(uSceneTexture, vUV).rgb;
    if (uGrayscale != 0) {
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = vec3(luminance);
    }
    fragmentColor = vec4(color, 1.0);
}
)glsl";

int gWindowWidth = 0;
int gWindowHeight = 0;
bool gDrawable = false;
bool gPaused = false;
bool gGrayscale = false;
float gAngle = 0.35F;

void updateWindowTitle(GLFWwindow* window) {
    std::ostringstream title;
    title << "Learn OpenGL - FBO " << kRenderWidth << 'x' << kRenderHeight
          << " -> window | " << (gPaused ? "paused" : "rotating")
          << " | " << (gGrayscale ? "grayscale" : "color")
          << " (Space, arrows, G, R)";
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
        return;
    }

    if (key == GLFW_KEY_SPACE) {
        gPaused = !gPaused;
    } else if (key == GLFW_KEY_LEFT) {
        gAngle -= 0.18F;
    } else if (key == GLFW_KEY_RIGHT) {
        gAngle += 0.18F;
    } else if (key == GLFW_KEY_G) {
        gGrayscale = !gGrayscale;
    } else if (key == GLFW_KEY_R) {
        gAngle = 0.35F;
        gPaused = false;
        gGrayscale = false;
    } else {
        return;
    }

    if (gAngle >= 2.0F * kPi) {
        gAngle -= 2.0F * kPi;
    } else if (gAngle < 0.0F) {
        gAngle += 2.0F * kPi;
    }
    updateWindowTitle(window);
}

void appendFace(
    std::vector<SceneVertex>& vertices,
    const std::array<float, 3>& a,
    const std::array<float, 3>& b,
    const std::array<float, 3>& c,
    const std::array<float, 3>& d,
    const std::array<float, 3>& color
) {
    vertices.push_back({ { a[0], a[1], a[2] }, { color[0], color[1], color[2] } });
    vertices.push_back({ { b[0], b[1], b[2] }, { color[0], color[1], color[2] } });
    vertices.push_back({ { c[0], c[1], c[2] }, { color[0], color[1], color[2] } });
    vertices.push_back({ { a[0], a[1], a[2] }, { color[0], color[1], color[2] } });
    vertices.push_back({ { c[0], c[1], c[2] }, { color[0], color[1], color[2] } });
    vertices.push_back({ { d[0], d[1], d[2] }, { color[0], color[1], color[2] } });
}

std::vector<SceneVertex> makeCubeVertices() {
    const float h = kCubeHalfExtent;
    std::vector<SceneVertex> vertices;
    vertices.reserve(36);
    appendFace(vertices, { -h, -h, h }, { h, -h, h }, { h, h, h }, { -h, h, h },
        { 0.96F, 0.20F, 0.15F });
    appendFace(vertices, { h, -h, -h }, { -h, -h, -h }, { -h, h, -h }, { h, h, -h },
        { 0.12F, 0.66F, 0.96F });
    appendFace(vertices, { h, -h, h }, { h, -h, -h }, { h, h, -h }, { h, h, h },
        { 0.23F, 0.88F, 0.34F });
    appendFace(vertices, { -h, -h, -h }, { -h, -h, h }, { -h, h, h }, { -h, h, -h },
        { 0.97F, 0.70F, 0.12F });
    appendFace(vertices, { -h, h, h }, { h, h, h }, { h, h, -h }, { -h, h, -h },
        { 0.77F, 0.28F, 0.91F });
    appendFace(vertices, { -h, -h, -h }, { h, -h, -h }, { h, -h, h }, { -h, -h, h },
        { 0.10F, 0.84F, 0.82F });
    return vertices;
}

std::array<ScreenVertex, 6> makeScreenVertices() {
    return {{
        { { -1.0F, -1.0F }, { 0.0F, 0.0F } },
        { {  1.0F, -1.0F }, { 1.0F, 0.0F } },
        { {  1.0F,  1.0F }, { 1.0F, 1.0F } },
        { { -1.0F, -1.0F }, { 0.0F, 0.0F } },
        { {  1.0F,  1.0F }, { 1.0F, 1.0F } },
        { { -1.0F,  1.0F }, { 0.0F, 1.0F } },
    }};
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

GLuint createProgram(const char* vertexSource, const char* fragmentSource) {
    const GLuint vertexShader = compileShader(GL_VERTEX_SHADER, vertexSource);
    if (vertexShader == 0) {
        return 0;
    }
    const GLuint fragmentShader = compileShader(GL_FRAGMENT_SHADER, fragmentSource);
    if (fragmentShader == 0) {
        glDeleteShader(vertexShader);
        return 0;
    }

    const GLuint program = glCreateProgram();
    if (program == 0) {
        std::cerr << "Failed to create shader program\n";
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

    glDetachShader(program, vertexShader);
    glDetachShader(program, fragmentShader);
    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);
    return program;
}

void createSceneMesh(const std::vector<SceneVertex>& vertices, GLuint& vertexArray, GLuint& vertexBuffer) {
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(
        GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(vertices.size() * sizeof(SceneVertex)),
        vertices.data(),
        GL_STATIC_DRAW
    );
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(SceneVertex),
        reinterpret_cast<const void*>(offsetof(SceneVertex, position)));
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(SceneVertex),
        reinterpret_cast<const void*>(offsetof(SceneVertex, color)));
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

void createScreenMesh(const std::array<ScreenVertex, 6>& vertices, GLuint& vertexArray, GLuint& vertexBuffer) {
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(ScreenVertex),
        reinterpret_cast<const void*>(offsetof(ScreenVertex, position)));
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(ScreenVertex),
        reinterpret_cast<const void*>(offsetof(ScreenVertex, uv)));
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

bool createRenderTarget(RenderTarget& target) {
    glGenTextures(1, &target.colorTexture);
    glBindTexture(GL_TEXTURE_2D, target.colorTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, kRenderWidth, kRenderHeight, 0,
        GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    glGenRenderbuffers(1, &target.depthStencil);
    glBindRenderbuffer(GL_RENDERBUFFER, target.depthStencil);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, kRenderWidth, kRenderHeight);

    glGenFramebuffers(1, &target.framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, target.framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, target.colorTexture, 0);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT,
        GL_RENDERBUFFER, target.depthStencil);

    const GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glBindRenderbuffer(GL_RENDERBUFFER, 0);
    glBindTexture(GL_TEXTURE_2D, 0);
    if (status != GL_FRAMEBUFFER_COMPLETE) {
        std::cerr << "Framebuffer is incomplete: 0x" << std::hex << status << std::dec << '\n';
        return false;
    }
    return true;
}

SceneUniforms getSceneUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uAngle"),
        glGetUniformLocation(program, "uAspect"),
    };
}

DisplayUniforms getDisplayUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uSceneTexture"),
        glGetUniformLocation(program, "uGrayscale"),
    };
}

bool hasRequiredUniforms(const SceneUniforms& uniforms) {
    return uniforms.angle >= 0 && uniforms.aspect >= 0;
}

bool hasRequiredUniforms(const DisplayUniforms& uniforms) {
    return uniforms.sceneTexture >= 0 && uniforms.grayscale >= 0;
}

void letterboxViewport(int windowWidth, int windowHeight, int& x, int& y, int& width, int& height) {
    const float targetAspect = static_cast<float>(kRenderWidth) / static_cast<float>(kRenderHeight);
    const float windowAspect = static_cast<float>(windowWidth) / static_cast<float>(windowHeight);
    if (windowAspect > targetAspect) {
        height = windowHeight;
        width = static_cast<int>(static_cast<float>(height) * targetAspect);
        x = (windowWidth - width) / 2;
        y = 0;
    } else {
        width = windowWidth;
        height = static_cast<int>(static_cast<float>(width) / targetAspect);
        x = 0;
        y = (windowHeight - height) / 2;
    }
}

void releaseResources(
    GLuint sceneProgram,
    GLuint displayProgram,
    GLuint sceneVertexArray,
    GLuint sceneVertexBuffer,
    GLuint screenVertexArray,
    GLuint screenVertexBuffer,
    const RenderTarget& target
) {
    if (sceneProgram != 0) glDeleteProgram(sceneProgram);
    if (displayProgram != 0) glDeleteProgram(displayProgram);
    if (sceneVertexArray != 0) glDeleteVertexArrays(1, &sceneVertexArray);
    if (sceneVertexBuffer != 0) glDeleteBuffers(1, &sceneVertexBuffer);
    if (screenVertexArray != 0) glDeleteVertexArrays(1, &screenVertexArray);
    if (screenVertexBuffer != 0) glDeleteBuffers(1, &screenVertexBuffer);
    if (target.framebuffer != 0) glDeleteFramebuffers(1, &target.framebuffer);
    if (target.colorTexture != 0) glDeleteTextures(1, &target.colorTexture);
    if (target.depthStencil != 0) glDeleteRenderbuffers(1, &target.depthStencil);
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
    glfwWindowHint(GLFW_STENCIL_BITS, 8);

    GLFWwindow* window = glfwCreateWindow(kWindowWidth, kWindowHeight,
        "Learn OpenGL - Framebuffer and Render-to-Texture", nullptr, nullptr);
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

    const GLuint sceneProgram = createProgram(kSceneVertexShader, kSceneFragmentShader);
    const GLuint displayProgram = createProgram(kDisplayVertexShader, kDisplayFragmentShader);
    GLuint sceneVertexArray = 0;
    GLuint sceneVertexBuffer = 0;
    GLuint screenVertexArray = 0;
    GLuint screenVertexBuffer = 0;
    RenderTarget target;

    const std::vector<SceneVertex> sceneVertices = makeCubeVertices();
    const std::array<ScreenVertex, 6> screenVertices = makeScreenVertices();
    createSceneMesh(sceneVertices, sceneVertexArray, sceneVertexBuffer);
    createScreenMesh(screenVertices, screenVertexArray, screenVertexBuffer);

    if (sceneProgram == 0 || displayProgram == 0 || !createRenderTarget(target)) {
        releaseResources(sceneProgram, displayProgram, sceneVertexArray, sceneVertexBuffer,
            screenVertexArray, screenVertexBuffer, target);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const SceneUniforms sceneUniforms = getSceneUniforms(sceneProgram);
    const DisplayUniforms displayUniforms = getDisplayUniforms(displayProgram);
    if (!hasRequiredUniforms(sceneUniforms) || !hasRequiredUniforms(displayUniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(sceneProgram, displayProgram, sceneVertexArray, sceneVertexBuffer,
            screenVertexArray, screenVertexBuffer, target);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glDisable(GL_CULL_FACE);
    double previousTime = glfwGetTime();

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        const double currentTime = glfwGetTime();
        const float deltaTime = static_cast<float>(std::min(currentTime - previousTime, 0.05));
        previousTime = currentTime;
        if (!gPaused) {
            gAngle += deltaTime * 0.8F;
            if (gAngle >= 2.0F * kPi) {
                gAngle -= 2.0F * kPi;
            }
        }

        if (gDrawable) {
            glBindFramebuffer(GL_FRAMEBUFFER, target.framebuffer);
            glViewport(0, 0, kRenderWidth, kRenderHeight);
            glEnable(GL_DEPTH_TEST);
            glClearColor(0.035F, 0.050F, 0.085F, 1.0F);
            glClearDepth(1.0);
            glClearStencil(0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
            glUseProgram(sceneProgram);
            glUniform1f(sceneUniforms.angle, gAngle);
            glUniform1f(sceneUniforms.aspect,
                static_cast<float>(kRenderWidth) / static_cast<float>(kRenderHeight));
            glBindVertexArray(sceneVertexArray);
            glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(sceneVertices.size()));

            glBindFramebuffer(GL_FRAMEBUFFER, 0);
            glViewport(0, 0, gWindowWidth, gWindowHeight);
            glClearColor(0.008F, 0.010F, 0.016F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);
            int panelX = 0;
            int panelY = 0;
            int panelWidth = 0;
            int panelHeight = 0;
            letterboxViewport(gWindowWidth, gWindowHeight, panelX, panelY, panelWidth, panelHeight);
            glViewport(panelX, panelY, panelWidth, panelHeight);
            glDisable(GL_DEPTH_TEST);
            glUseProgram(displayProgram);
            glUniform1i(displayUniforms.sceneTexture, 0);
            glUniform1i(displayUniforms.grayscale, gGrayscale ? 1 : 0);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, target.colorTexture);
            glBindVertexArray(screenVertexArray);
            glDrawArrays(GL_TRIANGLES, 0, 6);

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(sceneProgram, displayProgram, sceneVertexArray, sceneVertexBuffer,
        screenVertexArray, screenVertexBuffer, target);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
