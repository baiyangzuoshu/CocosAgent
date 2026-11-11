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

constexpr int kWindowWidth = 1180;
constexpr int kWindowHeight = 820;
constexpr int kRenderWidth = 960;
constexpr int kRenderHeight = 640;
constexpr float kSceneAspect = static_cast<float>(kRenderWidth) / static_cast<float>(kRenderHeight);
constexpr float kPi = 3.14159265358979323846F;

struct SceneVertex {
    float position[2];
    float color[3];
    float rotating;
};

struct ScreenVertex {
    float position[2];
    float uv[2];
};

struct ColorTarget {
    GLuint framebuffer = 0;
    GLuint colorTexture = 0;
};

struct SceneUniforms {
    GLint angle = -1;
    GLint aspect = -1;
};

struct PostUniforms {
    GLint inputTexture = -1;
    GLint texelSize = -1;
    GLint direction = -1;
    GLint filterMode = -1;
};

const char* kSceneVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec3 aColor;
layout (location = 2) in float aRotating;

uniform float uAngle;
uniform float uAspect;
out vec3 vColor;

void main() {
    vec2 position = aPosition;
    if (aRotating > 0.5) {
        float cosine = cos(uAngle);
        float sine = sin(uAngle);
        position = vec2(
            cosine * aPosition.x - sine * aPosition.y,
            sine * aPosition.x + cosine * aPosition.y
        );
    }
    gl_Position = vec4(position.x / uAspect, position.y, 0.0, 1.0);
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

const char* kPostVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec2 aUV;
out vec2 vUV;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aUV;
}
)glsl";

const char* kPostFragmentShader = R"glsl(
#version 330 core
in vec2 vUV;
uniform sampler2D uInputTexture;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform int uFilterMode;
out vec4 fragmentColor;

float luminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float sampleLuminance(vec2 offset) {
    return luminance(texture(uInputTexture, vUV + offset * uTexelSize).rgb);
}

void main() {
    vec3 color = texture(uInputTexture, vUV).rgb;

    if (uFilterMode == 1) {
        float gray = luminance(color);
        color = vec3(gray);
    } else if (uFilterMode == 2) {
        float topLeft = sampleLuminance(vec2(-1.0, 1.0));
        float top = sampleLuminance(vec2(0.0, 1.0));
        float topRight = sampleLuminance(vec2(1.0, 1.0));
        float left = sampleLuminance(vec2(-1.0, 0.0));
        float right = sampleLuminance(vec2(1.0, 0.0));
        float bottomLeft = sampleLuminance(vec2(-1.0, -1.0));
        float bottom = sampleLuminance(vec2(0.0, -1.0));
        float bottomRight = sampleLuminance(vec2(1.0, -1.0));

        float gradientX = -topLeft + topRight - 2.0 * left + 2.0 * right - bottomLeft + bottomRight;
        float gradientY = -topLeft - 2.0 * top - topRight + bottomLeft + 2.0 * bottom + bottomRight;
        float edge = clamp(length(vec2(gradientX, gradientY)) * 1.35, 0.0, 1.0);
        color = vec3(edge);
    } else if (uFilterMode == 3) {
        color *= 0.227027;
        for (int i = 1; i <= 4; ++i) {
            float weight = i == 1 ? 0.194595
                : (i == 2 ? 0.121622 : (i == 3 ? 0.054054 : 0.016216));
            vec2 offset = uDirection * uTexelSize * float(i);
            color += texture(uInputTexture, vUV + offset).rgb * weight;
            color += texture(uInputTexture, vUV - offset).rgb * weight;
        }
    }

    fragmentColor = vec4(color, 1.0);
}
)glsl";

int gWindowWidth = 0;
int gWindowHeight = 0;
bool gDrawable = false;
bool gPaused = false;
int gFilterMode = 0;
float gAngle = 0.2F;

const char* filterName(int mode) {
    switch (mode) {
    case 1: return "grayscale";
    case 2: return "Sobel edges";
    case 3: return "two-pass blur";
    default: return "original";
    }
}

void updateWindowTitle(GLFWwindow* window) {
    std::ostringstream title;
    title << "Learn OpenGL - post-processing | " << filterName(gFilterMode)
          << " | passes " << (gFilterMode == 3 ? 3 : 2)
          << " | " << (gPaused ? "paused" : "rotating")
          << " (1-4, Space, arrows, R)";
    glfwSetWindowTitle(window, title.str().c_str());
}

void framebufferSizeCallback(GLFWwindow* window, int width, int height) {
    gWindowWidth = width;
    gWindowHeight = height;
    gDrawable = width > 0 && height > 0;
    updateWindowTitle(window);
}

void keyCallback(GLFWwindow* window, int key, int, int action, int) {
    if (action != GLFW_PRESS && action != GLFW_REPEAT) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
        return;
    }

    if (key == GLFW_KEY_1 && action == GLFW_PRESS) {
        gFilterMode = 0;
    } else if (key == GLFW_KEY_2 && action == GLFW_PRESS) {
        gFilterMode = 1;
    } else if (key == GLFW_KEY_3 && action == GLFW_PRESS) {
        gFilterMode = 2;
    } else if (key == GLFW_KEY_4 && action == GLFW_PRESS) {
        gFilterMode = 3;
    } else if (key == GLFW_KEY_SPACE && action == GLFW_PRESS) {
        gPaused = !gPaused;
    } else if (key == GLFW_KEY_LEFT) {
        gAngle -= 0.15F;
    } else if (key == GLFW_KEY_RIGHT) {
        gAngle += 0.15F;
    } else if (key == GLFW_KEY_R && action == GLFW_PRESS) {
        gPaused = false;
        gFilterMode = 0;
        gAngle = 0.2F;
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

void appendVertex(
    std::vector<SceneVertex>& vertices,
    float x,
    float y,
    const std::array<float, 3>& color,
    bool rotating = false
) {
    vertices.push_back({ { x, y }, { color[0], color[1], color[2] }, rotating ? 1.0F : 0.0F });
}

void appendTriangle(
    std::vector<SceneVertex>& vertices,
    const std::array<float, 2>& a,
    const std::array<float, 2>& b,
    const std::array<float, 2>& c,
    const std::array<float, 3>& color,
    bool rotating = false
) {
    appendVertex(vertices, a[0], a[1], color, rotating);
    appendVertex(vertices, b[0], b[1], color, rotating);
    appendVertex(vertices, c[0], c[1], color, rotating);
}

void appendRectangle(
    std::vector<SceneVertex>& vertices,
    float left,
    float bottom,
    float right,
    float top,
    const std::array<float, 3>& color
) {
    appendTriangle(vertices, { left, bottom }, { right, bottom }, { right, top }, color);
    appendTriangle(vertices, { left, bottom }, { right, top }, { left, top }, color);
}

void appendCircle(
    std::vector<SceneVertex>& vertices,
    float centerX,
    float centerY,
    float radius,
    int segments,
    const std::array<float, 3>& color
) {
    for (int segment = 0; segment < segments; ++segment) {
        const float angle0 = 2.0F * kPi * static_cast<float>(segment) / static_cast<float>(segments);
        const float angle1 = 2.0F * kPi * static_cast<float>(segment + 1) / static_cast<float>(segments);
        appendTriangle(vertices,
            { centerX, centerY },
            { centerX + std::cos(angle0) * radius, centerY + std::sin(angle0) * radius },
            { centerX + std::cos(angle1) * radius, centerY + std::sin(angle1) * radius },
            color);
    }
}

std::vector<SceneVertex> makeSceneVertices() {
    std::vector<SceneVertex> vertices;
    vertices.reserve(720);

    appendRectangle(vertices, -1.38F, 0.78F, 1.38F, 0.90F, { 0.14F, 0.28F, 0.48F });
    appendRectangle(vertices, -1.38F, -0.89F, 1.38F, -0.78F, { 0.14F, 0.28F, 0.48F });
    appendRectangle(vertices, -1.35F, -0.62F, -1.04F, 0.64F, { 0.96F, 0.28F, 0.16F });
    appendRectangle(vertices, -0.90F, 0.20F, -0.46F, 0.63F, { 0.16F, 0.78F, 0.60F });
    appendRectangle(vertices, -0.90F, -0.42F, -0.46F, 0.06F, { 0.98F, 0.70F, 0.16F });
    appendRectangle(vertices, 0.93F, -0.58F, 1.32F, 0.57F, { 0.23F, 0.58F, 0.94F });
    appendRectangle(vertices, 0.83F, 0.64F, 1.32F, 0.72F, { 0.90F, 0.32F, 0.62F });
    appendRectangle(vertices, -0.95F, -0.70F, 0.95F, -0.66F, { 0.32F, 0.44F, 0.58F });

    const std::array<float, 3> barColors[] = {
        { 0.18F, 0.74F, 0.86F }, { 0.96F, 0.34F, 0.20F }, { 0.92F, 0.72F, 0.18F },
        { 0.48F, 0.84F, 0.36F }, { 0.72F, 0.34F, 0.90F }, { 0.16F, 0.64F, 0.78F },
        { 0.94F, 0.46F, 0.60F }, { 0.42F, 0.78F, 0.54F },
    };
    const float barHeights[] = { 0.24F, 0.42F, 0.31F, 0.55F, 0.37F, 0.49F, 0.28F, 0.40F };
    for (int i = 0; i < 8; ++i) {
        const float x = -0.85F + static_cast<float>(i) * 0.23F;
        appendRectangle(vertices, x, -0.60F, x + 0.12F, -0.60F + barHeights[i], barColors[i]);
    }

    appendCircle(vertices, 0.95F, 0.13F, 0.27F, 48, { 0.18F, 0.82F, 0.78F });
    appendCircle(vertices, 0.95F, 0.13F, 0.12F, 40, { 0.08F, 0.12F, 0.20F });

    appendTriangle(vertices, { 0.0F, 0.55F }, { -0.42F, -0.30F }, { 0.42F, -0.30F },
        { 0.94F, 0.26F, 0.18F }, true);
    appendTriangle(vertices, { 0.0F, -0.37F }, { 0.34F, 0.30F }, { -0.34F, 0.30F },
        { 0.98F, 0.74F, 0.18F }, true);
    appendCircle(vertices, 0.0F, 0.0F, 0.09F, 32, { 0.97F, 0.93F, 0.82F });
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
    glBufferData(GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(vertices.size() * sizeof(SceneVertex)), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(SceneVertex),
        reinterpret_cast<const void*>(offsetof(SceneVertex, position)));
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(SceneVertex),
        reinterpret_cast<const void*>(offsetof(SceneVertex, color)));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(2, 1, GL_FLOAT, GL_FALSE, sizeof(SceneVertex),
        reinterpret_cast<const void*>(offsetof(SceneVertex, rotating)));
    glEnableVertexAttribArray(2);
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

bool createColorTarget(ColorTarget& target, const char* label) {
    glGenTextures(1, &target.colorTexture);
    glBindTexture(GL_TEXTURE_2D, target.colorTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, kRenderWidth, kRenderHeight, 0,
        GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    glGenFramebuffers(1, &target.framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, target.framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, target.colorTexture, 0);
    glDrawBuffer(GL_COLOR_ATTACHMENT0);

    const GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glBindTexture(GL_TEXTURE_2D, 0);
    if (status != GL_FRAMEBUFFER_COMPLETE) {
        std::cerr << label << " framebuffer is incomplete: 0x"
                  << std::hex << status << std::dec << '\n';
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

PostUniforms getPostUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uInputTexture"),
        glGetUniformLocation(program, "uTexelSize"),
        glGetUniformLocation(program, "uDirection"),
        glGetUniformLocation(program, "uFilterMode"),
    };
}

bool hasRequiredUniforms(const SceneUniforms& uniforms) {
    return uniforms.angle >= 0 && uniforms.aspect >= 0;
}

bool hasRequiredUniforms(const PostUniforms& uniforms) {
    return uniforms.inputTexture >= 0
        && uniforms.texelSize >= 0
        && uniforms.direction >= 0
        && uniforms.filterMode >= 0;
}

void drawPostprocess(
    const PostUniforms& uniforms,
    GLuint inputTexture,
    int filterMode,
    float directionX,
    float directionY,
    GLuint screenVertexArray
) {
    glUniform1i(uniforms.inputTexture, 0);
    glUniform2f(uniforms.texelSize,
        1.0F / static_cast<float>(kRenderWidth),
        1.0F / static_cast<float>(kRenderHeight));
    glUniform2f(uniforms.direction, directionX, directionY);
    glUniform1i(uniforms.filterMode, filterMode);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, inputTexture);
    glBindVertexArray(screenVertexArray);
    glDrawArrays(GL_TRIANGLES, 0, 6);
}

void letterboxViewport(int windowWidth, int windowHeight, int& x, int& y, int& width, int& height) {
    const float windowAspect = static_cast<float>(windowWidth) / static_cast<float>(windowHeight);
    if (windowAspect > kSceneAspect) {
        height = windowHeight;
        width = static_cast<int>(static_cast<float>(height) * kSceneAspect);
        x = (windowWidth - width) / 2;
        y = 0;
    } else {
        width = windowWidth;
        height = static_cast<int>(static_cast<float>(width) / kSceneAspect);
        x = 0;
        y = (windowHeight - height) / 2;
    }
}

void releaseResources(
    GLuint sceneProgram,
    GLuint postProgram,
    GLuint sceneVertexArray,
    GLuint sceneVertexBuffer,
    GLuint screenVertexArray,
    GLuint screenVertexBuffer,
    const ColorTarget& sceneTarget,
    const ColorTarget& pingTarget
) {
    if (sceneProgram != 0) glDeleteProgram(sceneProgram);
    if (postProgram != 0) glDeleteProgram(postProgram);
    if (sceneVertexArray != 0) glDeleteVertexArrays(1, &sceneVertexArray);
    if (sceneVertexBuffer != 0) glDeleteBuffers(1, &sceneVertexBuffer);
    if (screenVertexArray != 0) glDeleteVertexArrays(1, &screenVertexArray);
    if (screenVertexBuffer != 0) glDeleteBuffers(1, &screenVertexBuffer);
    if (sceneTarget.framebuffer != 0) glDeleteFramebuffers(1, &sceneTarget.framebuffer);
    if (sceneTarget.colorTexture != 0) glDeleteTextures(1, &sceneTarget.colorTexture);
    if (pingTarget.framebuffer != 0) glDeleteFramebuffers(1, &pingTarget.framebuffer);
    if (pingTarget.colorTexture != 0) glDeleteTextures(1, &pingTarget.colorTexture);
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
        "Learn OpenGL - Fullscreen Post-processing", nullptr, nullptr);
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
    const GLuint postProgram = createProgram(kPostVertexShader, kPostFragmentShader);
    GLuint sceneVertexArray = 0;
    GLuint sceneVertexBuffer = 0;
    GLuint screenVertexArray = 0;
    GLuint screenVertexBuffer = 0;
    ColorTarget sceneTarget;
    ColorTarget pingTarget;

    const std::vector<SceneVertex> sceneVertices = makeSceneVertices();
    const std::array<ScreenVertex, 6> screenVertices = makeScreenVertices();
    createSceneMesh(sceneVertices, sceneVertexArray, sceneVertexBuffer);
    createScreenMesh(screenVertices, screenVertexArray, screenVertexBuffer);

    if (sceneProgram == 0 || postProgram == 0
        || !createColorTarget(sceneTarget, "Scene")
        || !createColorTarget(pingTarget, "Ping")) {
        releaseResources(sceneProgram, postProgram, sceneVertexArray, sceneVertexBuffer,
            screenVertexArray, screenVertexBuffer, sceneTarget, pingTarget);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const SceneUniforms sceneUniforms = getSceneUniforms(sceneProgram);
    const PostUniforms postUniforms = getPostUniforms(postProgram);
    if (!hasRequiredUniforms(sceneUniforms) || !hasRequiredUniforms(postUniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(sceneProgram, postProgram, sceneVertexArray, sceneVertexBuffer,
            screenVertexArray, screenVertexBuffer, sceneTarget, pingTarget);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glDisable(GL_DEPTH_TEST);
    double previousTime = glfwGetTime();

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        const double currentTime = glfwGetTime();
        const float deltaTime = static_cast<float>(std::min(currentTime - previousTime, 0.05));
        previousTime = currentTime;
        if (!gPaused) {
            gAngle += deltaTime * 0.75F;
            if (gAngle >= 2.0F * kPi) {
                gAngle -= 2.0F * kPi;
            }
        }

        if (gDrawable) {
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, 0);
            glBindFramebuffer(GL_FRAMEBUFFER, sceneTarget.framebuffer);
            glViewport(0, 0, kRenderWidth, kRenderHeight);
            glClearColor(0.035F, 0.050F, 0.085F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);
            glUseProgram(sceneProgram);
            glUniform1f(sceneUniforms.angle, gAngle);
            glUniform1f(sceneUniforms.aspect, kSceneAspect);
            glBindVertexArray(sceneVertexArray);
            glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(sceneVertices.size()));

            if (gFilterMode == 3) {
                glBindFramebuffer(GL_FRAMEBUFFER, pingTarget.framebuffer);
                glViewport(0, 0, kRenderWidth, kRenderHeight);
                glClearColor(0.0F, 0.0F, 0.0F, 1.0F);
                glClear(GL_COLOR_BUFFER_BIT);
                glUseProgram(postProgram);
                drawPostprocess(postUniforms, sceneTarget.colorTexture, 3, 1.0F, 0.0F, screenVertexArray);
            }

            glBindFramebuffer(GL_FRAMEBUFFER, 0);
            glViewport(0, 0, gWindowWidth, gWindowHeight);
            glClearColor(0.008F, 0.010F, 0.018F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);
            int viewX = 0;
            int viewY = 0;
            int viewWidth = 0;
            int viewHeight = 0;
            letterboxViewport(gWindowWidth, gWindowHeight, viewX, viewY, viewWidth, viewHeight);
            glViewport(viewX, viewY, viewWidth, viewHeight);
            glUseProgram(postProgram);
            const GLuint finalInput = gFilterMode == 3 ? pingTarget.colorTexture : sceneTarget.colorTexture;
            const float directionY = gFilterMode == 3 ? 1.0F : 0.0F;
            drawPostprocess(postUniforms, finalInput, gFilterMode, 0.0F, directionY, screenVertexArray);

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(sceneProgram, postProgram, sceneVertexArray, sceneVertexBuffer,
        screenVertexArray, screenVertexBuffer, sceneTarget, pingTarget);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
