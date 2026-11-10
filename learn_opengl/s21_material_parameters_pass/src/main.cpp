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
constexpr int kWindowHeight = 680;
constexpr int kSphereSegments = 64;
constexpr int kSphereRings = 32;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kCameraDistance = 3.4F;
constexpr float kSphereRadius = 0.95F;

using Vec3 = std::array<float, 3>;

struct Vertex {
    float position[3];
    float normal[3];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint cameraPosition = -1;
    GLint lightDirection = -1;
    GLint baseColor = -1;
    GLint specularStrength = -1;
    GLint shininess = -1;
    GLint outputMode = -1;
};

struct MaterialParameters {
    const char* name;
    Vec3 baseColor;
    float specularStrength;
    float shininess;
};

constexpr std::array<MaterialParameters, 3> kMaterialPresets{{
    { "Warm gloss", { 0.88F, 0.36F, 0.10F }, 0.95F, 64.0F },
    { "Teal matte", { 0.06F, 0.55F, 0.66F }, 0.16F, 8.0F },
    { "Violet plastic", { 0.38F, 0.16F, 0.72F }, 0.62F, 24.0F },
}};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

uniform float uAspect;
uniform vec3 uCameraPosition;
out vec3 vWorldPosition;
out vec3 vNormal;

void main() {
    vWorldPosition = aPosition;
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
    gl_Position = vec4(
        viewPosition.x * focalLength / uAspect,
        viewPosition.y * focalLength,
        clipZ,
        -viewPosition.z
    );
}
)glsl";

const char* kFragmentShaderSource = R"glsl(
#version 330 core
in vec3 vWorldPosition;
in vec3 vNormal;

uniform vec3 uCameraPosition;
uniform vec3 uLightDirection;
uniform vec3 uBaseColor;
uniform float uSpecularStrength;
uniform float uShininess;
uniform int uOutputMode;
out vec4 fragmentColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(uLightDirection);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);

    float normalLight = dot(normal, lightDirection);
    float diffuse = max(normalLight, 0.0);
    float specular = 0.0;
    if (normalLight > 0.0) {
        vec3 reflectedDirection = reflect(-lightDirection, normal);
        specular = pow(max(dot(reflectedDirection, viewDirection), 0.0), uShininess);
    }

    const vec3 lightColor = vec3(1.0, 0.90, 0.72);
    const vec3 ambientColor = vec3(0.035, 0.045, 0.060);
    vec3 baseContribution = uBaseColor * ambientColor
        + uBaseColor * lightColor * diffuse;
    vec3 specularContribution = lightColor * specular * uSpecularStrength;

    if (uOutputMode == 1) {
        fragmentColor = vec4(baseContribution, 1.0);
    } else if (uOutputMode == 2) {
        fragmentColor = vec4(specularContribution, 0.0);
    } else {
        fragmentColor = vec4(baseContribution + specularContribution, 1.0);
    }
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
float gCameraAzimuthDegrees = 0.0F;
float gCameraElevationDegrees = 16.0F;
int gMaterialIndex = 0;
bool gSpecularPassEnabled = true;
bool gDrawable = false;

float degreesToRadians(float degrees) {
    return degrees * kPi / 180.0F;
}

Vec3 currentCameraPosition() {
    const float azimuth = degreesToRadians(gCameraAzimuthDegrees);
    const float elevation = degreesToRadians(gCameraElevationDegrees);
    const float horizontalDistance = kCameraDistance * std::cos(elevation);
    return {
        horizontalDistance * std::sin(azimuth),
        kCameraDistance * std::sin(elevation),
        horizontalDistance * std::cos(azimuth),
    };
}

Vec3 normalize(const Vec3& value) {
    const float length = std::sqrt(
        value[0] * value[0] + value[1] * value[1] + value[2] * value[2]
    );
    return { value[0] / length, value[1] / length, value[2] / length };
}

Vec3 currentLightDirection() {
    return normalize(Vec3{ -0.45F, 0.72F, 0.88F });
}

const MaterialParameters& currentMaterial() {
    return kMaterialPresets[static_cast<std::size_t>(gMaterialIndex)];
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = std::string("Learn OpenGL - Material: ")
        + currentMaterial().name
        + " | specular pass: "
        + (gSpecularPassEnabled ? "ON" : "OFF")
        + " | camera azimuth: "
        + std::to_string(static_cast<int>(gCameraAzimuthDegrees))
        + " deg, elevation: "
        + std::to_string(static_cast<int>(gCameraElevationDegrees))
        + " deg (arrows, 1-3, P)";
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
        gCameraAzimuthDegrees -= 8.0F;
    } else if (key == GLFW_KEY_RIGHT) {
        gCameraAzimuthDegrees += 8.0F;
    } else if (key == GLFW_KEY_UP) {
        gCameraElevationDegrees = std::min(gCameraElevationDegrees + 5.0F, 65.0F);
    } else if (key == GLFW_KEY_DOWN) {
        gCameraElevationDegrees = std::max(gCameraElevationDegrees - 5.0F, -65.0F);
    } else if (key == GLFW_KEY_1) {
        gMaterialIndex = 0;
    } else if (key == GLFW_KEY_2) {
        gMaterialIndex = 1;
    } else if (key == GLFW_KEY_3) {
        gMaterialIndex = 2;
    } else if (key == GLFW_KEY_P) {
        if (action == GLFW_PRESS) {
            gSpecularPassEnabled = !gSpecularPassEnabled;
        }
    } else if (key == GLFW_KEY_R) {
        gCameraAzimuthDegrees = 0.0F;
        gCameraElevationDegrees = 16.0F;
        gMaterialIndex = 0;
        gSpecularPassEnabled = true;
    } else {
        return;
    }

    if (gCameraAzimuthDegrees >= 360.0F) {
        gCameraAzimuthDegrees -= 360.0F;
    } else if (gCameraAzimuthDegrees < 0.0F) {
        gCameraAzimuthDegrees += 360.0F;
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

void createMesh(
    const std::vector<Vertex>& vertices,
    GLuint& vertexArray,
    GLuint& vertexBuffer
) {
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

void drawSphere(
    GLuint vertexArray,
    GLsizei vertexCount,
    const UniformLocations& uniforms,
    float aspect,
    const Vec3& cameraPosition,
    const Vec3& lightDirection,
    const MaterialParameters& material,
    int outputMode
) {
    glUniform1f(uniforms.aspect, aspect);
    glUniform3f(uniforms.cameraPosition, cameraPosition[0], cameraPosition[1], cameraPosition[2]);
    glUniform3f(uniforms.lightDirection, lightDirection[0], lightDirection[1], lightDirection[2]);
    glUniform3f(
        uniforms.baseColor,
        material.baseColor[0],
        material.baseColor[1],
        material.baseColor[2]
    );
    glUniform1f(uniforms.specularStrength, material.specularStrength);
    glUniform1f(uniforms.shininess, material.shininess);
    glUniform1i(uniforms.outputMode, outputMode);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLES, 0, vertexCount);
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
        "Learn OpenGL - Material: Warm gloss | specular pass: ON",
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
    const UniformLocations uniforms{
        glGetUniformLocation(program, "uAspect"),
        glGetUniformLocation(program, "uCameraPosition"),
        glGetUniformLocation(program, "uLightDirection"),
        glGetUniformLocation(program, "uBaseColor"),
        glGetUniformLocation(program, "uSpecularStrength"),
        glGetUniformLocation(program, "uShininess"),
        glGetUniformLocation(program, "uOutputMode"),
    };
    if (uniforms.aspect < 0 || uniforms.cameraPosition < 0 || uniforms.lightDirection < 0
        || uniforms.baseColor < 0 || uniforms.specularStrength < 0 || uniforms.shininess < 0
        || uniforms.outputMode < 0) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, vertexBuffer, vertexArray);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glDisable(GL_CULL_FACE);
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            const int leftWidth = gFramebufferWidth / 2;
            const int rightWidth = gFramebufferWidth - leftWidth;
            const Vec3 cameraPosition = currentCameraPosition();
            const Vec3 lightDirection = currentLightDirection();

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glDisable(GL_BLEND);
            glDepthMask(GL_TRUE);
            glDepthFunc(GL_LESS);
            glClearColor(0.035F, 0.045F, 0.065F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glUseProgram(program);

            glViewport(0, 0, leftWidth, gFramebufferHeight);
            drawSphere(
                vertexArray,
                sphereVertexCount,
                uniforms,
                static_cast<float>(leftWidth) / static_cast<float>(gFramebufferHeight),
                cameraPosition,
                lightDirection,
                currentMaterial(),
                0
            );

            glViewport(leftWidth, 0, rightWidth, gFramebufferHeight);
            drawSphere(
                vertexArray,
                sphereVertexCount,
                uniforms,
                static_cast<float>(rightWidth) / static_cast<float>(gFramebufferHeight),
                cameraPosition,
                lightDirection,
                currentMaterial(),
                1
            );

            if (gSpecularPassEnabled) {
                glEnable(GL_BLEND);
                glBlendEquation(GL_FUNC_ADD);
                glBlendFuncSeparate(GL_ONE, GL_ONE, GL_ZERO, GL_ONE);
                glDepthFunc(GL_LEQUAL);
                glDepthMask(GL_FALSE);
                drawSphere(
                    vertexArray,
                    sphereVertexCount,
                    uniforms,
                    static_cast<float>(rightWidth) / static_cast<float>(gFramebufferHeight),
                    cameraPosition,
                    lightDirection,
                    currentMaterial(),
                    2
                );
            }

            glDepthMask(GL_TRUE);
            glDepthFunc(GL_LESS);
            glDisable(GL_BLEND);

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, vertexBuffer, vertexArray);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
