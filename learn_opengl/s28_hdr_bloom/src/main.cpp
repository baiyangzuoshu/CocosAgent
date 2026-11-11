#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {

constexpr int kWindowWidth = 1180;
constexpr int kWindowHeight = 820;
constexpr int kRenderWidth = 960;
constexpr int kRenderHeight = 640;
constexpr int kBloomWidth = kRenderWidth / 2;
constexpr int kBloomHeight = kRenderHeight / 2;
constexpr float kSceneAspect = static_cast<float>(kRenderWidth) / static_cast<float>(kRenderHeight);
constexpr float kPi = 3.14159265358979323846F;

struct SceneVertex {
    float position[2];
    float radiance[3];
};

struct ScreenVertex {
    float position[2];
    float uv[2];
};

struct ColorTarget {
    GLuint framebuffer = 0;
    GLuint colorTexture = 0;
    int width = 0;
    int height = 0;
};

struct SceneUniforms {
    GLint aspect = -1;
};

struct PostUniforms {
    GLint inputTexture = -1;
    GLint texelSize = -1;
    GLint direction = -1;
    GLint stage = -1;
    GLint threshold = -1;
};

struct CompositeUniforms {
    GLint sceneTexture = -1;
    GLint bloomTexture = -1;
    GLint viewMode = -1;
    GLint exposure = -1;
    GLint bloomStrength = -1;
};

const char* kSceneVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec3 aRadiance;
uniform float uAspect;
out vec3 vRadiance;

void main() {
    gl_Position = vec4(aPosition.x / uAspect, aPosition.y, 0.0, 1.0);
    vRadiance = aRadiance;
}
)glsl";

const char* kSceneFragmentShader = R"glsl(
#version 330 core
in vec3 vRadiance;
out vec4 fragmentColor;

void main() {
    fragmentColor = vec4(vRadiance, 1.0);
}
)glsl";

const char* kScreenVertexShader = R"glsl(
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
uniform int uStage;
uniform float uThreshold;
out vec4 fragmentColor;

void main() {
    vec3 color = texture(uInputTexture, vUV).rgb;

    if (uStage == 0) {
        float brightness = max(max(color.r, color.g), color.b);
        color = brightness > uThreshold ? color : vec3(0.0);
    } else {
        color *= 0.227027;
        for (int i = 1; i <= 4; ++i) {
            float weight = i == 1 ? 0.194595
                : (i == 2 ? 0.121622 : (i == 3 ? 0.054054 : 0.016216));
            vec2 offset = uDirection * uTexelSize * float(i);
            color += texture(uInputTexture, vUV + offset).rgb * weight;
            color += texture(uInputTexture, vUV - offset).rgb * weight;
        }
    }

    fragmentColor = vec4(max(color, vec3(0.0)), 1.0);
}
)glsl";

const char* kCompositeFragmentShader = R"glsl(
#version 330 core
in vec2 vUV;
uniform sampler2D uSceneTexture;
uniform sampler2D uBloomTexture;
uniform int uViewMode;
uniform float uExposure;
uniform float uBloomStrength;
out vec4 fragmentColor;

void main() {
    vec3 radiance = texture(uSceneTexture, vUV).rgb;
    if (uViewMode == 2) {
        radiance += texture(uBloomTexture, vUV).rgb * uBloomStrength;
    } else if (uViewMode == 3 || uViewMode == 4) {
        radiance = texture(uBloomTexture, vUV).rgb;
    }

    vec3 mapped = vec3(1.0) - exp(-max(radiance, vec3(0.0)) * uExposure);
    mapped = pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.2));
    fragmentColor = vec4(mapped, 1.0);
}
)glsl";

int gWindowWidth = 0;
int gWindowHeight = 0;
bool gDrawable = false;
int gViewMode = 2;
float gExposure = 0.85F;
float gBloomStrength = 0.9F;

const char* viewName(int mode) {
    switch (mode) {
    case 1: return "HDR tone map";
    case 2: return "HDR + Bloom";
    case 3: return "bright-pass";
    case 4: return "blurred Bloom";
    default: return "unknown";
    }
}

int passCountForMode(int mode) {
    if (mode == 1) return 2;
    if (mode == 3) return 3;
    return 5;
}

void updateWindowTitle(GLFWwindow* window) {
    std::ostringstream title;
    title << "Learn OpenGL - HDR and Bloom | " << viewName(gViewMode)
          << " | passes " << passCountForMode(gViewMode)
          << " | exposure " << std::fixed << std::setprecision(2) << gExposure
          << " | strength " << gBloomStrength
          << " (1-4, Up/Down exposure, Left/Right Bloom, R)";
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
        gViewMode = 1;
    } else if (key == GLFW_KEY_2 && action == GLFW_PRESS) {
        gViewMode = 2;
    } else if (key == GLFW_KEY_3 && action == GLFW_PRESS) {
        gViewMode = 3;
    } else if (key == GLFW_KEY_4 && action == GLFW_PRESS) {
        gViewMode = 4;
    } else if (key == GLFW_KEY_UP) {
        gExposure = std::min(gExposure + 0.05F, 3.0F);
    } else if (key == GLFW_KEY_DOWN) {
        gExposure = std::max(gExposure - 0.05F, 0.05F);
    } else if (key == GLFW_KEY_RIGHT) {
        gBloomStrength = std::min(gBloomStrength + 0.05F, 3.0F);
    } else if (key == GLFW_KEY_LEFT) {
        gBloomStrength = std::max(gBloomStrength - 0.05F, 0.0F);
    } else if (key == GLFW_KEY_R && action == GLFW_PRESS) {
        gViewMode = 2;
        gExposure = 0.85F;
        gBloomStrength = 0.9F;
    } else {
        return;
    }

    updateWindowTitle(window);
}

void appendVertex(
    std::vector<SceneVertex>& vertices,
    float x,
    float y,
    const std::array<float, 3>& radiance
) {
    vertices.push_back({ { x, y }, { radiance[0], radiance[1], radiance[2] } });
}

void appendTriangle(
    std::vector<SceneVertex>& vertices,
    const std::array<float, 2>& a,
    const std::array<float, 2>& b,
    const std::array<float, 2>& c,
    const std::array<float, 3>& radiance
) {
    appendVertex(vertices, a[0], a[1], radiance);
    appendVertex(vertices, b[0], b[1], radiance);
    appendVertex(vertices, c[0], c[1], radiance);
}

void appendRectangle(
    std::vector<SceneVertex>& vertices,
    float left,
    float bottom,
    float right,
    float top,
    const std::array<float, 3>& radiance
) {
    appendTriangle(vertices, { left, bottom }, { right, bottom }, { right, top }, radiance);
    appendTriangle(vertices, { left, bottom }, { right, top }, { left, top }, radiance);
}

void appendCircle(
    std::vector<SceneVertex>& vertices,
    float centerX,
    float centerY,
    float radius,
    int segments,
    const std::array<float, 3>& radiance
) {
    for (int segment = 0; segment < segments; ++segment) {
        const float angle0 = 2.0F * kPi * static_cast<float>(segment) / static_cast<float>(segments);
        const float angle1 = 2.0F * kPi * static_cast<float>(segment + 1) / static_cast<float>(segments);
        appendTriangle(vertices,
            { centerX, centerY },
            { centerX + std::cos(angle0) * radius, centerY + std::sin(angle0) * radius },
            { centerX + std::cos(angle1) * radius, centerY + std::sin(angle1) * radius },
            radiance);
    }
}

std::vector<SceneVertex> makeSceneVertices() {
    std::vector<SceneVertex> vertices;
    vertices.reserve(2400);

    appendRectangle(vertices, -1.30F, -0.82F, 1.30F, -0.67F, { 0.035F, 0.060F, 0.105F });
    appendRectangle(vertices, -1.30F, -0.67F, 1.30F, -0.62F, { 0.18F, 0.28F, 0.42F });
    appendRectangle(vertices, -1.12F, -0.48F, 1.12F, 0.58F, { 0.025F, 0.040F, 0.080F });
    appendRectangle(vertices, -1.12F, 0.54F, 1.12F, 0.58F, { 0.24F, 0.32F, 0.46F });

    const float columnX[] = { -0.98F, -0.73F, -0.48F, -0.23F, 0.23F, 0.48F, 0.73F, 0.98F };
    const float columnHeight[] = { 0.42F, 0.62F, 0.34F, 0.52F, 0.40F, 0.66F, 0.47F, 0.57F };
    for (int i = 0; i < 8; ++i) {
        const float x = columnX[i];
        appendRectangle(vertices, x, -0.60F, x + 0.11F, -0.60F + columnHeight[i],
            { 0.08F, 0.13F, 0.22F });
        appendRectangle(vertices, x + 0.025F, -0.54F, x + 0.085F, -0.49F,
            { 0.24F, 0.37F, 0.52F });
        appendRectangle(vertices, x + 0.025F, -0.43F, x + 0.085F, -0.38F,
            { 0.18F, 0.28F, 0.42F });
    }

    appendRectangle(vertices, -0.93F, 0.12F, -0.82F, 0.44F, { 4.8F, 0.35F, 0.08F });
    appendRectangle(vertices, -0.68F, -0.35F, -0.55F, 0.34F, { 0.12F, 3.1F, 1.7F });
    appendRectangle(vertices, -0.38F, 0.02F, -0.24F, 0.44F, { 3.6F, 1.1F, 0.12F });
    appendRectangle(vertices, 0.22F, -0.22F, 0.36F, 0.43F, { 0.20F, 2.2F, 4.4F });
    appendRectangle(vertices, 0.52F, 0.10F, 0.64F, 0.44F, { 3.5F, 0.22F, 2.8F });
    appendRectangle(vertices, 0.82F, -0.30F, 0.94F, 0.42F, { 0.18F, 3.4F, 1.0F });

    appendCircle(vertices, -0.78F, 0.34F, 0.105F, 48, { 6.0F, 2.0F, 0.30F });
    appendCircle(vertices, -0.02F, 0.24F, 0.16F, 56, { 4.5F, 0.25F, 3.6F });
    appendCircle(vertices, -0.02F, 0.24F, 0.060F, 40, { 8.0F, 6.0F, 4.2F });
    appendCircle(vertices, 0.78F, 0.34F, 0.105F, 48, { 0.25F, 4.1F, 7.0F });
    appendCircle(vertices, -1.02F, -0.56F, 0.035F, 24, { 2.5F, 0.45F, 0.12F });
    appendCircle(vertices, 1.02F, -0.56F, 0.035F, 24, { 0.20F, 1.8F, 3.0F });

    appendRectangle(vertices, -0.92F, -0.77F, -0.25F, -0.73F, { 0.35F, 0.10F, 0.06F });
    appendRectangle(vertices, -0.12F, -0.77F, 0.42F, -0.73F, { 0.08F, 0.28F, 0.38F });
    appendRectangle(vertices, 0.55F, -0.77F, 1.08F, -0.73F, { 0.30F, 0.12F, 0.32F });
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
    if (vertexShader == 0) return 0;
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
        reinterpret_cast<const void*>(offsetof(SceneVertex, radiance)));
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

bool createColorTarget(ColorTarget& target, int width, int height, const char* label) {
    target.width = width;
    target.height = height;
    glGenTextures(1, &target.colorTexture);
    glBindTexture(GL_TEXTURE_2D, target.colorTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, width, height, 0,
        GL_RGBA, GL_FLOAT, nullptr);
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
    return { glGetUniformLocation(program, "uAspect") };
}

PostUniforms getPostUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uInputTexture"),
        glGetUniformLocation(program, "uTexelSize"),
        glGetUniformLocation(program, "uDirection"),
        glGetUniformLocation(program, "uStage"),
        glGetUniformLocation(program, "uThreshold"),
    };
}

CompositeUniforms getCompositeUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uSceneTexture"),
        glGetUniformLocation(program, "uBloomTexture"),
        glGetUniformLocation(program, "uViewMode"),
        glGetUniformLocation(program, "uExposure"),
        glGetUniformLocation(program, "uBloomStrength"),
    };
}

bool hasRequiredUniforms(const SceneUniforms& uniforms) {
    return uniforms.aspect >= 0;
}

bool hasRequiredUniforms(const PostUniforms& uniforms) {
    return uniforms.inputTexture >= 0
        && uniforms.texelSize >= 0
        && uniforms.direction >= 0
        && uniforms.stage >= 0
        && uniforms.threshold >= 0;
}

bool hasRequiredUniforms(const CompositeUniforms& uniforms) {
    return uniforms.sceneTexture >= 0
        && uniforms.bloomTexture >= 0
        && uniforms.viewMode >= 0
        && uniforms.exposure >= 0
        && uniforms.bloomStrength >= 0;
}

void drawPostPass(
    const PostUniforms& uniforms,
    GLuint inputTexture,
    int inputWidth,
    int inputHeight,
    int stage,
    float directionX,
    float directionY,
    GLuint screenVertexArray
) {
    glUniform1i(uniforms.inputTexture, 0);
    glUniform2f(uniforms.texelSize,
        1.0F / static_cast<float>(inputWidth),
        1.0F / static_cast<float>(inputHeight));
    glUniform2f(uniforms.direction, directionX, directionY);
    glUniform1i(uniforms.stage, stage);
    glUniform1f(uniforms.threshold, 1.0F);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, inputTexture);
    glBindVertexArray(screenVertexArray);
    glDrawArrays(GL_TRIANGLES, 0, 6);
}

void drawComposite(
    const CompositeUniforms& uniforms,
    GLuint sceneTexture,
    GLuint bloomTexture,
    GLuint screenVertexArray
) {
    glUniform1i(uniforms.sceneTexture, 0);
    glUniform1i(uniforms.bloomTexture, 1);
    glUniform1i(uniforms.viewMode, gViewMode);
    glUniform1f(uniforms.exposure, gExposure);
    glUniform1f(uniforms.bloomStrength, gBloomStrength);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, sceneTexture);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, bloomTexture);
    glBindVertexArray(screenVertexArray);
    glDrawArrays(GL_TRIANGLES, 0, 6);
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

void unbindSampledTextures() {
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, 0);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, 0);
    glActiveTexture(GL_TEXTURE0);
}

void releaseResources(
    GLuint sceneProgram,
    GLuint postProgram,
    GLuint compositeProgram,
    GLuint sceneVertexArray,
    GLuint sceneVertexBuffer,
    GLuint screenVertexArray,
    GLuint screenVertexBuffer,
    const ColorTarget& sceneTarget,
    const ColorTarget& bloomTarget,
    const ColorTarget& pingTarget
) {
    if (sceneProgram != 0) glDeleteProgram(sceneProgram);
    if (postProgram != 0) glDeleteProgram(postProgram);
    if (compositeProgram != 0) glDeleteProgram(compositeProgram);
    if (sceneVertexArray != 0) glDeleteVertexArrays(1, &sceneVertexArray);
    if (sceneVertexBuffer != 0) glDeleteBuffers(1, &sceneVertexBuffer);
    if (screenVertexArray != 0) glDeleteVertexArrays(1, &screenVertexArray);
    if (screenVertexBuffer != 0) glDeleteBuffers(1, &screenVertexBuffer);
    if (sceneTarget.framebuffer != 0) glDeleteFramebuffers(1, &sceneTarget.framebuffer);
    if (sceneTarget.colorTexture != 0) glDeleteTextures(1, &sceneTarget.colorTexture);
    if (bloomTarget.framebuffer != 0) glDeleteFramebuffers(1, &bloomTarget.framebuffer);
    if (bloomTarget.colorTexture != 0) glDeleteTextures(1, &bloomTarget.colorTexture);
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
        "Learn OpenGL - HDR and Bloom", nullptr, nullptr);
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

    glDisable(GL_DEPTH_TEST);
    glDisable(GL_FRAMEBUFFER_SRGB);

    const GLuint sceneProgram = createProgram(kSceneVertexShader, kSceneFragmentShader);
    const GLuint postProgram = createProgram(kScreenVertexShader, kPostFragmentShader);
    const GLuint compositeProgram = createProgram(kScreenVertexShader, kCompositeFragmentShader);
    GLuint sceneVertexArray = 0;
    GLuint sceneVertexBuffer = 0;
    GLuint screenVertexArray = 0;
    GLuint screenVertexBuffer = 0;
    ColorTarget sceneTarget;
    ColorTarget bloomTarget;
    ColorTarget pingTarget;

    const std::vector<SceneVertex> sceneVertices = makeSceneVertices();
    const std::array<ScreenVertex, 6> screenVertices = makeScreenVertices();
    createSceneMesh(sceneVertices, sceneVertexArray, sceneVertexBuffer);
    createScreenMesh(screenVertices, screenVertexArray, screenVertexBuffer);

    if (sceneProgram == 0 || postProgram == 0 || compositeProgram == 0
        || !createColorTarget(sceneTarget, kRenderWidth, kRenderHeight, "SceneHDR")
        || !createColorTarget(bloomTarget, kBloomWidth, kBloomHeight, "BloomA")
        || !createColorTarget(pingTarget, kBloomWidth, kBloomHeight, "BloomB")) {
        releaseResources(sceneProgram, postProgram, compositeProgram,
            sceneVertexArray, sceneVertexBuffer, screenVertexArray, screenVertexBuffer,
            sceneTarget, bloomTarget, pingTarget);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const SceneUniforms sceneUniforms = getSceneUniforms(sceneProgram);
    const PostUniforms postUniforms = getPostUniforms(postProgram);
    const CompositeUniforms compositeUniforms = getCompositeUniforms(compositeProgram);
    if (!hasRequiredUniforms(sceneUniforms)
        || !hasRequiredUniforms(postUniforms)
        || !hasRequiredUniforms(compositeUniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(sceneProgram, postProgram, compositeProgram,
            sceneVertexArray, sceneVertexBuffer, screenVertexArray, screenVertexBuffer,
            sceneTarget, bloomTarget, pingTarget);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            unbindSampledTextures();
            glBindFramebuffer(GL_FRAMEBUFFER, sceneTarget.framebuffer);
            glViewport(0, 0, sceneTarget.width, sceneTarget.height);
            glClearColor(0.012F, 0.018F, 0.035F, 1.0F);
            glClear(GL_COLOR_BUFFER_BIT);
            glUseProgram(sceneProgram);
            glUniform1f(sceneUniforms.aspect, kSceneAspect);
            glBindVertexArray(sceneVertexArray);
            glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(sceneVertices.size()));

            if (gViewMode != 1) {
                glBindFramebuffer(GL_FRAMEBUFFER, bloomTarget.framebuffer);
                glViewport(0, 0, bloomTarget.width, bloomTarget.height);
                glClearColor(0.0F, 0.0F, 0.0F, 1.0F);
                glClear(GL_COLOR_BUFFER_BIT);
                glUseProgram(postProgram);
                drawPostPass(postUniforms, sceneTarget.colorTexture,
                    sceneTarget.width, sceneTarget.height, 0, 0.0F, 0.0F, screenVertexArray);
            }

            if (gViewMode == 2 || gViewMode == 4) {
                glBindFramebuffer(GL_FRAMEBUFFER, pingTarget.framebuffer);
                glViewport(0, 0, pingTarget.width, pingTarget.height);
                glClearColor(0.0F, 0.0F, 0.0F, 1.0F);
                glClear(GL_COLOR_BUFFER_BIT);
                glUseProgram(postProgram);
                drawPostPass(postUniforms, bloomTarget.colorTexture,
                    bloomTarget.width, bloomTarget.height, 1, 1.0F, 0.0F, screenVertexArray);

                glBindFramebuffer(GL_FRAMEBUFFER, bloomTarget.framebuffer);
                glViewport(0, 0, bloomTarget.width, bloomTarget.height);
                glClear(GL_COLOR_BUFFER_BIT);
                drawPostPass(postUniforms, pingTarget.colorTexture,
                    pingTarget.width, pingTarget.height, 1, 0.0F, 1.0F, screenVertexArray);
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
            glUseProgram(compositeProgram);
            drawComposite(compositeUniforms, sceneTarget.colorTexture,
                bloomTarget.colorTexture, screenVertexArray);
            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(sceneProgram, postProgram, compositeProgram,
        sceneVertexArray, sceneVertexBuffer, screenVertexArray, screenVertexBuffer,
        sceneTarget, bloomTarget, pingTarget);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
