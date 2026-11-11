#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

namespace {

constexpr int kWindowWidth = 1000;
constexpr int kWindowHeight = 700;
constexpr int kSphereSegments = 64;
constexpr int kSphereRings = 32;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kCameraDistance = 3.5F;
constexpr float kSphereRadius = 0.95F;
constexpr float kDefaultLightAzimuthDegrees = 35.0F;
constexpr float kDefaultLightElevationDegrees = 38.0F;

using Vec3 = std::array<float, 3>;

struct Vertex {
    float position[3];
    float normal[3];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint cameraPosition = -1;
    GLint lightDirection = -1;
    GLint lightColorLinear = -1;
    GLint baseColorSrgb = -1;
    GLint encodeSrgb = -1;
};

constexpr Vec3 kBaseColorSrgb{ 0.74F, 0.30F, 0.12F };
constexpr Vec3 kLightColorLinear{ 1.0F, 0.96F, 0.90F };

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

uniform float uAspect;
uniform vec3 uCameraPosition;
out vec3 vNormal;

void main() {
    vNormal = aNormal;

    vec3 forward = normalize(-uCameraPosition);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 relativePosition = aPosition - uCameraPosition;
    vec3 viewPosition = vec3(
        dot(relativePosition, right),
        dot(relativePosition, up),
        -dot(relativePosition, forward)
    );

    const float nearPlane = 0.1;
    const float farPlane = 20.0;
    const float focalLength = 1.65;
    float clipZ = ((farPlane + nearPlane) / (nearPlane - farPlane)) * viewPosition.z
        + ((2.0 * farPlane * nearPlane) / (nearPlane - farPlane));
    vec4 clipPosition = vec4(
        viewPosition.x * focalLength / uAspect,
        viewPosition.y * focalLength,
        clipZ,
        -viewPosition.z
    );
    clipPosition.xy *= 0.78;
    clipPosition.y += 0.17 * clipPosition.w;
    gl_Position = clipPosition;
}
)glsl";

const char* kFragmentShaderSource = R"glsl(
#version 330 core
in vec3 vNormal;

uniform vec3 uLightDirection;
uniform vec3 uLightColorLinear;
uniform vec3 uBaseColorSrgb;
uniform int uEncodeSrgb;

out vec4 fragmentColor;

float srgbToLinearChannel(float encoded) {
    if (encoded <= 0.04045) {
        return encoded / 12.92;
    }
    return pow((encoded + 0.055) / 1.055, 2.4);
}

float linearToSrgbChannel(float linear) {
    linear = max(linear, 0.0);
    if (linear <= 0.0031308) {
        return 12.92 * linear;
    }
    return 1.055 * pow(linear, 1.0 / 2.4) - 0.055;
}

vec3 srgbToLinear(vec3 encoded) {
    return vec3(
        srgbToLinearChannel(encoded.r),
        srgbToLinearChannel(encoded.g),
        srgbToLinearChannel(encoded.b)
    );
}

vec3 linearToSrgb(vec3 linear) {
    return vec3(
        linearToSrgbChannel(linear.r),
        linearToSrgbChannel(linear.g),
        linearToSrgbChannel(linear.b)
    );
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(uLightDirection);
    float diffuse = max(dot(normal, lightDirection), 0.0);

    vec3 baseColorLinear = srgbToLinear(uBaseColorSrgb);
    float illumination = clamp(0.035 + 0.95 * diffuse, 0.0, 1.0);
    vec3 linearColor = clamp(baseColorLinear * uLightColorLinear * illumination, 0.0, 1.0);

    vec3 outputColor = linearColor;
    if (uEncodeSrgb != 0) {
        outputColor = linearToSrgb(linearColor);
    }
    fragmentColor = vec4(outputColor, 1.0);
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
float gLightAzimuthDegrees = kDefaultLightAzimuthDegrees;
float gLightElevationDegrees = kDefaultLightElevationDegrees;
bool gDrawable = false;

float degreesToRadians(float degrees) {
    return degrees * kPi / 180.0F;
}

Vec3 normalize(const Vec3& value) {
    const float length = std::sqrt(
        value[0] * value[0] + value[1] * value[1] + value[2] * value[2]
    );
    if (length <= 0.0001F) {
        return { 0.0F, 0.0F, 1.0F };
    }
    return { value[0] / length, value[1] / length, value[2] / length };
}

Vec3 currentLightDirection() {
    const float azimuth = degreesToRadians(gLightAzimuthDegrees);
    const float elevation = degreesToRadians(gLightElevationDegrees);
    const float horizontalLength = std::cos(elevation);
    return normalize(Vec3{
        horizontalLength * std::sin(azimuth),
        std::sin(elevation),
        horizontalLength * std::cos(azimuth),
    });
}

Vec3 currentCameraPosition() {
    return { 0.0F, 0.0F, kCameraDistance };
}

float linearToSrgb(float linear) {
    if (linear <= 0.0031308F) {
        return 12.92F * linear;
    }
    return 1.055F * std::pow(linear, 1.0F / 2.4F) - 0.055F;
}

void setUniformVec3(GLint location, const Vec3& value) {
    glUniform3f(location, value[0], value[1], value[2]);
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = std::string("Learn OpenGL - Left: linear output | Right: sRGB encoded")
        + " | light azimuth: "
        + std::to_string(static_cast<int>(gLightAzimuthDegrees))
        + " deg, elevation: "
        + std::to_string(static_cast<int>(gLightElevationDegrees))
        + " deg (arrows, R)";
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
    if (action != GLFW_PRESS && action != GLFW_REPEAT) {
        return;
    }

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
        return;
    }

    if (key == GLFW_KEY_LEFT) {
        gLightAzimuthDegrees -= 8.0F;
    } else if (key == GLFW_KEY_RIGHT) {
        gLightAzimuthDegrees += 8.0F;
    } else if (key == GLFW_KEY_UP) {
        gLightElevationDegrees = std::min(gLightElevationDegrees + 5.0F, 80.0F);
    } else if (key == GLFW_KEY_DOWN) {
        gLightElevationDegrees = std::max(gLightElevationDegrees - 5.0F, -80.0F);
    } else if (key == GLFW_KEY_R && action == GLFW_PRESS) {
        gLightAzimuthDegrees = kDefaultLightAzimuthDegrees;
        gLightElevationDegrees = kDefaultLightElevationDegrees;
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

void appendVertex(std::vector<Vertex>& vertices, const Vec3& position) {
    const Vec3 normal = normalize(position);
    vertices.push_back({
        { position[0], position[1], position[2] },
        { normal[0], normal[1], normal[2] },
    });
}

std::vector<Vertex> makeSphereVertices() {
    std::vector<Vertex> vertices;
    vertices.reserve(static_cast<std::size_t>(kSphereSegments * kSphereRings * 6));

    const auto pointAt = [](float latitude, float longitude) {
        const float radialDistance = kSphereRadius * std::sin(latitude);
        return Vec3{
            radialDistance * std::cos(longitude),
            kSphereRadius * std::cos(latitude),
            radialDistance * std::sin(longitude),
        };
    };

    for (int ring = 0; ring < kSphereRings; ++ring) {
        const float latitude0 = kPi * static_cast<float>(ring) / static_cast<float>(kSphereRings);
        const float latitude1 = kPi * static_cast<float>(ring + 1) / static_cast<float>(kSphereRings);
        for (int segment = 0; segment < kSphereSegments; ++segment) {
            const float longitude0 = 2.0F * kPi * static_cast<float>(segment)
                / static_cast<float>(kSphereSegments);
            const float longitude1 = 2.0F * kPi * static_cast<float>(segment + 1)
                / static_cast<float>(kSphereSegments);

            const Vec3 p00 = pointAt(latitude0, longitude0);
            const Vec3 p10 = pointAt(latitude1, longitude0);
            const Vec3 p11 = pointAt(latitude1, longitude1);
            const Vec3 p01 = pointAt(latitude0, longitude1);
            appendVertex(vertices, p00);
            appendVertex(vertices, p10);
            appendVertex(vertices, p11);
            appendVertex(vertices, p00);
            appendVertex(vertices, p11);
            appendVertex(vertices, p01);
        }
    }

    return vertices;
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

void createMesh(const std::vector<Vertex>& vertices, GLuint& vertexArray, GLuint& vertexBuffer) {
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(
        GL_ARRAY_BUFFER,
        static_cast<GLsizeiptr>(vertices.size() * sizeof(Vertex)),
        vertices.data(),
        GL_STATIC_DRAW
    );
    glVertexAttribPointer(
        0,
        3,
        GL_FLOAT,
        GL_FALSE,
        static_cast<GLsizei>(sizeof(Vertex)),
        reinterpret_cast<const void*>(offsetof(Vertex, position))
    );
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(
        1,
        3,
        GL_FLOAT,
        GL_FALSE,
        static_cast<GLsizei>(sizeof(Vertex)),
        reinterpret_cast<const void*>(offsetof(Vertex, normal))
    );
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

UniformLocations getUniformLocations(GLuint program) {
    return {
        glGetUniformLocation(program, "uAspect"),
        glGetUniformLocation(program, "uCameraPosition"),
        glGetUniformLocation(program, "uLightDirection"),
        glGetUniformLocation(program, "uLightColorLinear"),
        glGetUniformLocation(program, "uBaseColorSrgb"),
        glGetUniformLocation(program, "uEncodeSrgb"),
    };
}

bool hasRequiredUniforms(const UniformLocations& uniforms) {
    return uniforms.aspect >= 0
        && uniforms.cameraPosition >= 0
        && uniforms.lightDirection >= 0
        && uniforms.lightColorLinear >= 0
        && uniforms.baseColorSrgb >= 0
        && uniforms.encodeSrgb >= 0;
}

void drawSphere(
    GLuint vertexArray,
    GLsizei vertexCount,
    const UniformLocations& uniforms,
    float aspect,
    const Vec3& lightDirection,
    int encodeSrgb
) {
    const Vec3 cameraPosition = currentCameraPosition();
    setUniformVec3(uniforms.cameraPosition, cameraPosition);
    setUniformVec3(uniforms.lightDirection, lightDirection);
    setUniformVec3(uniforms.lightColorLinear, kLightColorLinear);
    setUniformVec3(uniforms.baseColorSrgb, kBaseColorSrgb);
    glUniform1f(uniforms.aspect, aspect);
    glUniform1i(uniforms.encodeSrgb, encodeSrgb);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLES, 0, vertexCount);
}

void drawSwatches(int panelX, int panelWidth, int framebufferHeight, bool encodeMidpoint) {
    const float midpoint = encodeMidpoint ? linearToSrgb(0.5F) : 0.5F;
    const float values[] = { 0.0F, midpoint, 1.0F };
    const int horizontalPadding = std::max(panelWidth / 10, 8);
    const int gap = 8;
    const int availableWidth = panelWidth - 2 * horizontalPadding - 2 * gap;
    const int cellWidth = availableWidth / 3;
    if (cellWidth <= 0) {
        return;
    }

    const int y = std::max(framebufferHeight / 18, 10);
    const int height = std::max(framebufferHeight / 14, 20);
    glDisable(GL_DEPTH_TEST);
    glEnable(GL_SCISSOR_TEST);
    for (int i = 0; i < 3; ++i) {
        const int x = panelX + horizontalPadding + i * (cellWidth + gap);
        glScissor(x, y, cellWidth, height);
        glClearColor(values[i], values[i], values[i], 1.0F);
        glClear(GL_COLOR_BUFFER_BIT);
    }
    glDisable(GL_SCISSOR_TEST);
    glEnable(GL_DEPTH_TEST);
}

void drawPanel(
    int panelX,
    int panelWidth,
    int framebufferHeight,
    bool encodeSrgb,
    GLuint vertexArray,
    GLsizei vertexCount,
    const UniformLocations& uniforms,
    const Vec3& lightDirection
) {
    glViewport(panelX, 0, panelWidth, framebufferHeight);
    drawSphere(
        vertexArray,
        vertexCount,
        uniforms,
        static_cast<float>(panelWidth) / static_cast<float>(framebufferHeight),
        lightDirection,
        encodeSrgb ? 1 : 0
    );
    drawSwatches(panelX, panelWidth, framebufferHeight, encodeSrgb);
}

void releaseResources(GLuint program, GLuint vertexBuffer, GLuint vertexArray) {
    if (program != 0) {
        glDeleteProgram(program);
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
    glfwWindowHint(GLFW_DEPTH_BITS, 24);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif

    GLFWwindow* window = glfwCreateWindow(
        kWindowWidth,
        kWindowHeight,
        "Learn OpenGL - Linear RGB and sRGB Output",
        nullptr,
        nullptr
    );
    if (window == nullptr) {
        std::cerr << "Failed to create an OpenGL 3.3 window with a depth buffer\n";
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

    GLint depthBits = 0;
    glGetIntegerv(GL_DEPTH_BITS, &depthBits);
    if (depthBits < 1) {
        std::cerr << "The default framebuffer does not provide a depth buffer\n";
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

    const std::vector<Vertex> sphereVertices = makeSphereVertices();
    const GLsizei sphereVertexCount = static_cast<GLsizei>(sphereVertices.size());
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    createMesh(sphereVertices, vertexArray, vertexBuffer);

    const GLuint program = createProgram();
    if (program == 0) {
        releaseResources(0, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    const UniformLocations uniforms = getUniformLocations(program);
    if (!hasRequiredUniforms(uniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glDisable(GL_CULL_FACE);
    glDisable(GL_FRAMEBUFFER_SRGB);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const int leftWidth = gFramebufferWidth / 2;
            const int rightWidth = gFramebufferWidth - leftWidth;
            const Vec3 lightDirection = currentLightDirection();

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glDisable(GL_SCISSOR_TEST);
            glClearColor(0.035F, 0.045F, 0.065F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glUseProgram(program);

            drawPanel(
                0,
                leftWidth,
                gFramebufferHeight,
                false,
                vertexArray,
                sphereVertexCount,
                uniforms,
                lightDirection
            );
            drawPanel(
                leftWidth,
                rightWidth,
                gFramebufferHeight,
                true,
                vertexArray,
                sphereVertexCount,
                uniforms,
                lightDirection
            );

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, vertexBuffer, vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
