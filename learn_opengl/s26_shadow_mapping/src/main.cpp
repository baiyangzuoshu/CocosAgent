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
constexpr int kShadowMapSize = 1024;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kNearPlane = 0.1F;
constexpr float kFarPlane = 22.0F;
constexpr float kLightExtent = 7.0F;
constexpr float kLightDistance = 9.0F;
constexpr float kCubeHalfExtent = 0.5F;

using Vec3 = std::array<float, 3>;
using Mat4 = std::array<float, 16>;

struct Vertex {
    float position[3];
    float normal[3];
};

struct Mesh {
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    GLsizei vertexCount = 0;
};

struct ShadowTarget {
    GLuint framebuffer = 0;
    GLuint depthTexture = 0;
};

struct DepthUniforms {
    GLint lightViewProjection = -1;
    GLint model = -1;
};

struct SceneUniforms {
    GLint cameraViewProjection = -1;
    GLint lightViewProjection = -1;
    GLint model = -1;
    GLint baseColor = -1;
    GLint lightDirection = -1;
    GLint shadowMap = -1;
    GLint shadowEnabled = -1;
    GLint shadowBias = -1;
};

struct PreviewUniforms {
    GLint depthMap = -1;
};

const char* kDepthVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
uniform mat4 uLightViewProjection;
uniform mat4 uModel;

void main() {
    gl_Position = uLightViewProjection * uModel * vec4(aPosition, 1.0);
}
)glsl";

const char* kDepthFragmentShader = R"glsl(
#version 330 core
void main() {
}
)glsl";

const char* kSceneVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

uniform mat4 uCameraViewProjection;
uniform mat4 uLightViewProjection;
uniform mat4 uModel;

out vec3 vWorldNormal;
out vec4 vLightSpacePosition;

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);
    vWorldNormal = normalize(mat3(uModel) * aNormal);
    vLightSpacePosition = uLightViewProjection * worldPosition;
    gl_Position = uCameraViewProjection * worldPosition;
}
)glsl";

const char* kSceneFragmentShader = R"glsl(
#version 330 core
in vec3 vWorldNormal;
in vec4 vLightSpacePosition;

uniform vec3 uBaseColor;
uniform vec3 uLightDirection;
uniform sampler2D uShadowMap;
uniform int uShadowEnabled;
uniform float uShadowBias;
out vec4 fragmentColor;

float calculateShadow(vec3 normal, vec3 lightDirection) {
    vec3 projected = vLightSpacePosition.xyz / vLightSpacePosition.w;
    projected = projected * 0.5 + 0.5;

    if (projected.z > 1.0 || projected.z < 0.0
        || projected.x < 0.0 || projected.x > 1.0
        || projected.y < 0.0 || projected.y > 1.0) {
        return 0.0;
    }

    float closestDepth = texture(uShadowMap, projected.xy).r;
    float diffuseForBias = max(dot(normal, lightDirection), 0.0);
    float bias = max(uShadowBias * (1.0 - diffuseForBias), uShadowBias * 0.2);
    return projected.z - bias > closestDepth ? 1.0 : 0.0;
}

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 lightDirection = normalize(uLightDirection);
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float shadow = uShadowEnabled != 0 ? calculateShadow(normal, lightDirection) : 0.0;
    float illumination = 0.24 + (1.0 - shadow * 0.78) * diffuse * 0.76;
    fragmentColor = vec4(uBaseColor * illumination, 1.0);
}
)glsl";

const char* kPreviewVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec2 aUV;
out vec2 vUV;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aUV;
}
)glsl";

const char* kPreviewFragmentShader = R"glsl(
#version 330 core
in vec2 vUV;
uniform sampler2D uDepthMap;
out vec4 fragmentColor;

void main() {
    float depth = texture(uDepthMap, vUV).r;
    float preview = 1.0 - depth;
    fragmentColor = vec4(vec3(preview), 1.0);
}
)glsl";

int gWindowWidth = 0;
int gWindowHeight = 0;
bool gDrawable = false;
bool gPaused = false;
bool gShadowsEnabled = true;
bool gDepthPreviewEnabled = true;
float gCubeAngle = -0.22F;
float gLightAzimuthDegrees = 42.0F;
float gLightElevationDegrees = 54.0F;
float gShadowBias = 0.0035F;

float degreesToRadians(float degrees) {
    return degrees * kPi / 180.0F;
}

Vec3 subtract(const Vec3& a, const Vec3& b) {
    return { a[0] - b[0], a[1] - b[1], a[2] - b[2] };
}

Vec3 cross(const Vec3& a, const Vec3& b) {
    return {
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    };
}

float dot(const Vec3& a, const Vec3& b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

Vec3 normalize(const Vec3& value) {
    const float length = std::sqrt(dot(value, value));
    if (length <= 0.0001F) {
        return { 0.0F, 1.0F, 0.0F };
    }
    return { value[0] / length, value[1] / length, value[2] / length };
}

Mat4 identityMatrix() {
    return {{
        1.0F, 0.0F, 0.0F, 0.0F,
        0.0F, 1.0F, 0.0F, 0.0F,
        0.0F, 0.0F, 1.0F, 0.0F,
        0.0F, 0.0F, 0.0F, 1.0F,
    }};
}

Mat4 multiply(const Mat4& a, const Mat4& b) {
    Mat4 result{};
    for (int column = 0; column < 4; ++column) {
        for (int row = 0; row < 4; ++row) {
            for (int index = 0; index < 4; ++index) {
                result[static_cast<std::size_t>(column * 4 + row)] +=
                    a[static_cast<std::size_t>(index * 4 + row)]
                    * b[static_cast<std::size_t>(column * 4 + index)];
            }
        }
    }
    return result;
}

Mat4 translationMatrix(const Vec3& translation) {
    Mat4 result = identityMatrix();
    result[12] = translation[0];
    result[13] = translation[1];
    result[14] = translation[2];
    return result;
}

Mat4 rotationYMatrix(float angle) {
    const float cosine = std::cos(angle);
    const float sine = std::sin(angle);
    return {{
        cosine, 0.0F, -sine, 0.0F,
        0.0F, 1.0F, 0.0F, 0.0F,
        sine, 0.0F, cosine, 0.0F,
        0.0F, 0.0F, 0.0F, 1.0F,
    }};
}

Mat4 scaleMatrix(float scale) {
    return {{
        scale, 0.0F, 0.0F, 0.0F,
        0.0F, scale, 0.0F, 0.0F,
        0.0F, 0.0F, scale, 0.0F,
        0.0F, 0.0F, 0.0F, 1.0F,
    }};
}

Mat4 modelMatrix(const Vec3& position, float angle, float scale) {
    return multiply(translationMatrix(position),
        multiply(rotationYMatrix(angle), scaleMatrix(scale)));
}

Mat4 lookAtMatrix(const Vec3& eye, const Vec3& target, const Vec3& up) {
    const Vec3 forward = normalize(subtract(target, eye));
    const Vec3 side = normalize(cross(forward, up));
    const Vec3 correctedUp = cross(side, forward);
    return {{
        side[0], correctedUp[0], -forward[0], 0.0F,
        side[1], correctedUp[1], -forward[1], 0.0F,
        side[2], correctedUp[2], -forward[2], 0.0F,
        -dot(side, eye), -dot(correctedUp, eye), dot(forward, eye), 1.0F,
    }};
}

Mat4 perspectiveMatrix(float verticalFov, float aspect, float nearPlane, float farPlane) {
    const float focalLength = 1.0F / std::tan(verticalFov * 0.5F);
    Mat4 result{};
    result[0] = focalLength / aspect;
    result[5] = focalLength;
    result[10] = (farPlane + nearPlane) / (nearPlane - farPlane);
    result[11] = -1.0F;
    result[14] = (2.0F * farPlane * nearPlane) / (nearPlane - farPlane);
    return result;
}

Mat4 orthographicMatrix(float left, float right, float bottom, float top, float nearPlane, float farPlane) {
    Mat4 result = identityMatrix();
    result[0] = 2.0F / (right - left);
    result[5] = 2.0F / (top - bottom);
    result[10] = -2.0F / (farPlane - nearPlane);
    result[12] = -(right + left) / (right - left);
    result[13] = -(top + bottom) / (top - bottom);
    result[14] = -(farPlane + nearPlane) / (farPlane - nearPlane);
    return result;
}

Vec3 lightPosition() {
    const float azimuth = degreesToRadians(gLightAzimuthDegrees);
    const float elevation = degreesToRadians(gLightElevationDegrees);
    const float horizontal = kLightDistance * std::cos(elevation);
    return {
        horizontal * std::cos(azimuth),
        kLightDistance * std::sin(elevation),
        horizontal * std::sin(azimuth),
    };
}

Mat4 lightViewProjection(const Vec3& position) {
    const Mat4 projection = orthographicMatrix(
        -kLightExtent, kLightExtent, -kLightExtent, kLightExtent, kNearPlane, kFarPlane);
    const Mat4 view = lookAtMatrix(position, { 0.0F, 0.6F, 0.0F }, { 0.0F, 1.0F, 0.0F });
    return multiply(projection, view);
}

Mat4 cameraViewProjection(float aspect) {
    const Mat4 projection = perspectiveMatrix(degreesToRadians(44.0F), aspect, 0.1F, 35.0F);
    const Mat4 view = lookAtMatrix({ 7.0F, 6.0F, 9.0F }, { 0.0F, 0.65F, 0.0F }, { 0.0F, 1.0F, 0.0F });
    return multiply(projection, view);
}

void updateWindowTitle(GLFWwindow* window) {
    std::ostringstream title;
    title << "Learn OpenGL - Shadow Mapping | shadow " << (gShadowsEnabled ? "ON" : "OFF")
          << " | depth preview " << (gDepthPreviewEnabled ? "ON" : "OFF")
          << " | bias " << std::fixed << std::setprecision(4) << gShadowBias
          << " (B, D, arrows, -/=, Space, R)";
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

    if (key == GLFW_KEY_SPACE && action == GLFW_PRESS) {
        gPaused = !gPaused;
    } else if (key == GLFW_KEY_LEFT) {
        gLightAzimuthDegrees -= 6.0F;
    } else if (key == GLFW_KEY_RIGHT) {
        gLightAzimuthDegrees += 6.0F;
    } else if (key == GLFW_KEY_UP) {
        gLightElevationDegrees = std::min(gLightElevationDegrees + 4.0F, 78.0F);
    } else if (key == GLFW_KEY_DOWN) {
        gLightElevationDegrees = std::max(gLightElevationDegrees - 4.0F, 22.0F);
    } else if (key == GLFW_KEY_B && action == GLFW_PRESS) {
        gShadowsEnabled = !gShadowsEnabled;
    } else if (key == GLFW_KEY_D && action == GLFW_PRESS) {
        gDepthPreviewEnabled = !gDepthPreviewEnabled;
    } else if (key == GLFW_KEY_MINUS) {
        gShadowBias = std::max(gShadowBias - 0.0005F, 0.0001F);
    } else if (key == GLFW_KEY_EQUAL) {
        gShadowBias = std::min(gShadowBias + 0.0005F, 0.0200F);
    } else if (key == GLFW_KEY_R && action == GLFW_PRESS) {
        gPaused = false;
        gShadowsEnabled = true;
        gDepthPreviewEnabled = true;
        gCubeAngle = -0.22F;
        gLightAzimuthDegrees = 42.0F;
        gLightElevationDegrees = 54.0F;
        gShadowBias = 0.0035F;
    } else {
        return;
    }

    if (gLightAzimuthDegrees >= 360.0F) {
        gLightAzimuthDegrees -= 360.0F;
    } else if (gLightAzimuthDegrees < 0.0F) {
        gLightAzimuthDegrees += 360.0F;
    }
    updateWindowTitle(window);
}

void appendFace(
    std::vector<Vertex>& vertices,
    const Vec3& a,
    const Vec3& b,
    const Vec3& c,
    const Vec3& d,
    const Vec3& normal
) {
    vertices.push_back({ { a[0], a[1], a[2] }, { normal[0], normal[1], normal[2] } });
    vertices.push_back({ { b[0], b[1], b[2] }, { normal[0], normal[1], normal[2] } });
    vertices.push_back({ { c[0], c[1], c[2] }, { normal[0], normal[1], normal[2] } });
    vertices.push_back({ { a[0], a[1], a[2] }, { normal[0], normal[1], normal[2] } });
    vertices.push_back({ { c[0], c[1], c[2] }, { normal[0], normal[1], normal[2] } });
    vertices.push_back({ { d[0], d[1], d[2] }, { normal[0], normal[1], normal[2] } });
}

std::vector<Vertex> makeCubeVertices() {
    const float h = kCubeHalfExtent;
    std::vector<Vertex> vertices;
    vertices.reserve(36);
    appendFace(vertices, { -h, -h, h }, { h, -h, h }, { h, h, h }, { -h, h, h }, { 0.0F, 0.0F, 1.0F });
    appendFace(vertices, { h, -h, -h }, { -h, -h, -h }, { -h, h, -h }, { h, h, -h }, { 0.0F, 0.0F, -1.0F });
    appendFace(vertices, { h, -h, h }, { h, -h, -h }, { h, h, -h }, { h, h, h }, { 1.0F, 0.0F, 0.0F });
    appendFace(vertices, { -h, -h, -h }, { -h, -h, h }, { -h, h, h }, { -h, h, -h }, { -1.0F, 0.0F, 0.0F });
    appendFace(vertices, { -h, h, h }, { h, h, h }, { h, h, -h }, { -h, h, -h }, { 0.0F, 1.0F, 0.0F });
    appendFace(vertices, { -h, -h, -h }, { h, -h, -h }, { h, -h, h }, { -h, -h, h }, { 0.0F, -1.0F, 0.0F });
    return vertices;
}

std::vector<Vertex> makeGroundVertices() {
    const float extent = 6.0F;
    const Vec3 normal{ 0.0F, 1.0F, 0.0F };
    const Vec3 a{ -extent, 0.0F, -extent };
    const Vec3 b{ extent, 0.0F, -extent };
    const Vec3 c{ extent, 0.0F, extent };
    const Vec3 d{ -extent, 0.0F, extent };
    std::vector<Vertex> vertices;
    vertices.reserve(6);
    appendFace(vertices, a, b, c, d, normal);
    return vertices;
}

std::array<float, 16> makePreviewVertices() {
    return {{
        -1.0F, -1.0F, 0.0F, 0.0F,
         1.0F, -1.0F, 1.0F, 0.0F,
         1.0F,  1.0F, 1.0F, 1.0F,
        -1.0F, -1.0F, 0.0F, 0.0F,
         1.0F,  1.0F, 1.0F, 1.0F,
        -1.0F,  1.0F, 0.0F, 1.0F,
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

void createMesh(const std::vector<Vertex>& vertices, Mesh& mesh) {
    mesh.vertexCount = static_cast<GLsizei>(vertices.size());
    glGenVertexArrays(1, &mesh.vertexArray);
    glGenBuffers(1, &mesh.vertexBuffer);
    glBindVertexArray(mesh.vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, mesh.vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(vertices.size() * sizeof(Vertex)), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex),
        reinterpret_cast<const void*>(offsetof(Vertex, position)));
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex),
        reinterpret_cast<const void*>(offsetof(Vertex, normal)));
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

void createPreviewMesh(const std::array<float, 16>& vertices, GLuint& vertexArray, GLuint& vertexBuffer) {
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), nullptr);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
        reinterpret_cast<const void*>(2 * sizeof(float)));
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

bool createShadowTarget(ShadowTarget& target) {
    glGenTextures(1, &target.depthTexture);
    glBindTexture(GL_TEXTURE_2D, target.depthTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT24, kShadowMapSize, kShadowMapSize, 0,
        GL_DEPTH_COMPONENT, GL_FLOAT, nullptr);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_COMPARE_MODE, GL_NONE);
    const float borderColor[] = { 1.0F, 1.0F, 1.0F, 1.0F };
    glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);

    glGenFramebuffers(1, &target.framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, target.framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, target.depthTexture, 0);
    glDrawBuffer(GL_NONE);
    glReadBuffer(GL_NONE);

    const GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glBindTexture(GL_TEXTURE_2D, 0);
    if (status != GL_FRAMEBUFFER_COMPLETE) {
        std::cerr << "Shadow framebuffer is incomplete: 0x" << std::hex << status << std::dec << '\n';
        return false;
    }
    return true;
}

DepthUniforms getDepthUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uLightViewProjection"),
        glGetUniformLocation(program, "uModel"),
    };
}

SceneUniforms getSceneUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uCameraViewProjection"),
        glGetUniformLocation(program, "uLightViewProjection"),
        glGetUniformLocation(program, "uModel"),
        glGetUniformLocation(program, "uBaseColor"),
        glGetUniformLocation(program, "uLightDirection"),
        glGetUniformLocation(program, "uShadowMap"),
        glGetUniformLocation(program, "uShadowEnabled"),
        glGetUniformLocation(program, "uShadowBias"),
    };
}

PreviewUniforms getPreviewUniforms(GLuint program) {
    return { glGetUniformLocation(program, "uDepthMap") };
}

bool hasRequiredUniforms(const DepthUniforms& uniforms) {
    return uniforms.lightViewProjection >= 0 && uniforms.model >= 0;
}

bool hasRequiredUniforms(const SceneUniforms& uniforms) {
    return uniforms.cameraViewProjection >= 0
        && uniforms.lightViewProjection >= 0
        && uniforms.model >= 0
        && uniforms.baseColor >= 0
        && uniforms.lightDirection >= 0
        && uniforms.shadowMap >= 0
        && uniforms.shadowEnabled >= 0
        && uniforms.shadowBias >= 0;
}

bool hasRequiredUniforms(const PreviewUniforms& uniforms) {
    return uniforms.depthMap >= 0;
}

void drawDepthMesh(const Mesh& mesh, const Mat4& model, const DepthUniforms& uniforms) {
    glUniformMatrix4fv(uniforms.model, 1, GL_FALSE, model.data());
    glBindVertexArray(mesh.vertexArray);
    glDrawArrays(GL_TRIANGLES, 0, mesh.vertexCount);
}

void drawSceneMesh(
    const Mesh& mesh,
    const Mat4& model,
    const Vec3& color,
    const SceneUniforms& uniforms
) {
    glUniformMatrix4fv(uniforms.model, 1, GL_FALSE, model.data());
    glUniform3f(uniforms.baseColor, color[0], color[1], color[2]);
    glBindVertexArray(mesh.vertexArray);
    glDrawArrays(GL_TRIANGLES, 0, mesh.vertexCount);
}

void releaseResources(
    GLuint depthProgram,
    GLuint sceneProgram,
    GLuint previewProgram,
    const Mesh& cube,
    const Mesh& ground,
    GLuint previewVertexArray,
    GLuint previewVertexBuffer,
    const ShadowTarget& target
) {
    if (depthProgram != 0) glDeleteProgram(depthProgram);
    if (sceneProgram != 0) glDeleteProgram(sceneProgram);
    if (previewProgram != 0) glDeleteProgram(previewProgram);
    if (cube.vertexArray != 0) glDeleteVertexArrays(1, &cube.vertexArray);
    if (cube.vertexBuffer != 0) glDeleteBuffers(1, &cube.vertexBuffer);
    if (ground.vertexArray != 0) glDeleteVertexArrays(1, &ground.vertexArray);
    if (ground.vertexBuffer != 0) glDeleteBuffers(1, &ground.vertexBuffer);
    if (previewVertexArray != 0) glDeleteVertexArrays(1, &previewVertexArray);
    if (previewVertexBuffer != 0) glDeleteBuffers(1, &previewVertexBuffer);
    if (target.framebuffer != 0) glDeleteFramebuffers(1, &target.framebuffer);
    if (target.depthTexture != 0) glDeleteTextures(1, &target.depthTexture);
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

    GLFWwindow* window = glfwCreateWindow(kWindowWidth, kWindowHeight,
        "Learn OpenGL - Shadow Mapping", nullptr, nullptr);
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

    const GLuint depthProgram = createProgram(kDepthVertexShader, kDepthFragmentShader);
    const GLuint sceneProgram = createProgram(kSceneVertexShader, kSceneFragmentShader);
    const GLuint previewProgram = createProgram(kPreviewVertexShader, kPreviewFragmentShader);
    Mesh cube;
    Mesh ground;
    GLuint previewVertexArray = 0;
    GLuint previewVertexBuffer = 0;
    ShadowTarget target;

    createMesh(makeCubeVertices(), cube);
    createMesh(makeGroundVertices(), ground);
    createPreviewMesh(makePreviewVertices(), previewVertexArray, previewVertexBuffer);

    if (depthProgram == 0 || sceneProgram == 0 || previewProgram == 0 || !createShadowTarget(target)) {
        releaseResources(depthProgram, sceneProgram, previewProgram, cube, ground,
            previewVertexArray, previewVertexBuffer, target);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const DepthUniforms depthUniforms = getDepthUniforms(depthProgram);
    const SceneUniforms sceneUniforms = getSceneUniforms(sceneProgram);
    const PreviewUniforms previewUniforms = getPreviewUniforms(previewProgram);
    if (!hasRequiredUniforms(depthUniforms)
        || !hasRequiredUniforms(sceneUniforms)
        || !hasRequiredUniforms(previewUniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(depthProgram, sceneProgram, previewProgram, cube, ground,
            previewVertexArray, previewVertexBuffer, target);
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
            gCubeAngle += deltaTime * 0.75F;
            if (gCubeAngle >= 2.0F * kPi) {
                gCubeAngle -= 2.0F * kPi;
            }
        }

        const Vec3 light = lightPosition();
        const Vec3 lightDirection = normalize(subtract(light, { 0.0F, 0.6F, 0.0F }));
        const Mat4 lightVP = lightViewProjection(light);
        const Mat4 cubeModel = modelMatrix({ 0.45F, 0.78F, 0.0F }, gCubeAngle, 1.55F);
        const Mat4 smallCubeModel = modelMatrix({ -1.75F, 0.43F, -0.55F }, -gCubeAngle * 0.6F, 0.86F);
        const Mat4 groundModel = identityMatrix();

        if (gDrawable) {
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, 0);
            glBindFramebuffer(GL_FRAMEBUFFER, target.framebuffer);
            glViewport(0, 0, kShadowMapSize, kShadowMapSize);
            glEnable(GL_DEPTH_TEST);
            glClearDepth(1.0);
            glClear(GL_DEPTH_BUFFER_BIT);
            glUseProgram(depthProgram);
            glUniformMatrix4fv(depthUniforms.lightViewProjection, 1, GL_FALSE, lightVP.data());
            drawDepthMesh(ground, groundModel, depthUniforms);
            drawDepthMesh(cube, cubeModel, depthUniforms);
            drawDepthMesh(cube, smallCubeModel, depthUniforms);

            glBindFramebuffer(GL_FRAMEBUFFER, 0);
            glViewport(0, 0, gWindowWidth, gWindowHeight);
            glEnable(GL_DEPTH_TEST);
            glClearColor(0.075F, 0.090F, 0.125F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            const float aspect = static_cast<float>(gWindowWidth) / static_cast<float>(gWindowHeight);
            const Mat4 cameraVP = cameraViewProjection(aspect);
            glUseProgram(sceneProgram);
            glUniformMatrix4fv(sceneUniforms.cameraViewProjection, 1, GL_FALSE, cameraVP.data());
            glUniformMatrix4fv(sceneUniforms.lightViewProjection, 1, GL_FALSE, lightVP.data());
            glUniform3f(sceneUniforms.lightDirection, lightDirection[0], lightDirection[1], lightDirection[2]);
            glUniform1i(sceneUniforms.shadowMap, 0);
            glUniform1i(sceneUniforms.shadowEnabled, gShadowsEnabled ? 1 : 0);
            glUniform1f(sceneUniforms.shadowBias, gShadowBias);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, target.depthTexture);
            drawSceneMesh(ground, groundModel, { 0.68F, 0.70F, 0.73F }, sceneUniforms);
            drawSceneMesh(cube, cubeModel, { 0.93F, 0.28F, 0.16F }, sceneUniforms);
            drawSceneMesh(cube, smallCubeModel, { 0.20F, 0.58F, 0.92F }, sceneUniforms);

            if (gDepthPreviewEnabled) {
                const int previewSize = std::min(280, std::min(gWindowWidth / 3, gWindowHeight / 3));
                if (previewSize >= 64) {
                    glViewport(gWindowWidth - previewSize - 20, 20, previewSize, previewSize);
                    glDisable(GL_DEPTH_TEST);
                    glUseProgram(previewProgram);
                    glUniform1i(previewUniforms.depthMap, 0);
                    glBindVertexArray(previewVertexArray);
                    glDrawArrays(GL_TRIANGLES, 0, 6);
                }
            }

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(depthProgram, sceneProgram, previewProgram, cube, ground,
        previewVertexArray, previewVertexBuffer, target);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
