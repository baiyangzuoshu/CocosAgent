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

constexpr int kWindowWidth = 1100;
constexpr int kWindowHeight = 760;
constexpr int kSphereSegments = 64;
constexpr int kSphereRings = 32;
constexpr int kCubeFaceSize = 64;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kCameraDistance = 3.5F;
constexpr float kSphereRadius = 0.90F;

using Vec3 = std::array<float, 3>;

struct Vertex {
    float position[3];
    float normal[3];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint cameraPosition = -1;
    GLint environment = -1;
    GLint renderMode = -1;
    GLint baseColor = -1;
};

constexpr Vec3 kBaseColor{ 0.08F, 0.24F, 0.44F };
constexpr std::array<Vec3, 6> kCubeFaceColors{{
    { 1.00F, 0.16F, 0.10F }, // +X red
    { 0.05F, 0.72F, 0.92F }, // -X cyan
    { 0.20F, 0.92F, 0.16F }, // +Y green
    { 0.95F, 0.54F, 0.06F }, // -Y orange
    { 0.16F, 0.28F, 1.00F }, // +Z blue
    { 0.88F, 0.10F, 0.78F }, // -Z magenta
}};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

uniform float uAspect;
uniform vec3 uCameraPosition;
uniform int uRenderMode;
out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vCubeDirection;

void main() {
    vWorldPosition = aPosition;
    vNormal = aNormal;
    vCubeDirection = aPosition;

    vec3 forward = normalize(-uCameraPosition);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    const float nearPlane = 0.1;
    const float farPlane = 20.0;
    const float focalLength = 1.65;

    if (uRenderMode == 0) {
        // Treat cube vertices as directions from the camera, so translation is absent.
        vec3 viewDirection = vec3(
            dot(aPosition, right),
            dot(aPosition, up),
            -dot(aPosition, forward)
        );
        float clipW = -viewDirection.z;
        gl_Position = vec4(
            viewDirection.x * focalLength / uAspect,
            viewDirection.y * focalLength,
            clipW,
            clipW
        );
    } else {
        vec3 relativePosition = aPosition - uCameraPosition;
        vec3 viewPosition = vec3(
            dot(relativePosition, right),
            dot(relativePosition, up),
            -dot(relativePosition, forward)
        );
        float clipZ = ((farPlane + nearPlane) / (nearPlane - farPlane)) * viewPosition.z
            + ((2.0 * farPlane * nearPlane) / (nearPlane - farPlane));
        gl_Position = vec4(
            viewPosition.x * focalLength / uAspect,
            viewPosition.y * focalLength,
            clipZ,
            -viewPosition.z
        );
    }
}
)glsl";

const char* kFragmentShaderSource = R"glsl(
#version 330 core
in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vCubeDirection;

uniform vec3 uCameraPosition;
uniform samplerCube uEnvironment;
uniform int uRenderMode;
uniform vec3 uBaseColor;
out vec4 fragmentColor;

void main() {
    if (uRenderMode == 0) {
        fragmentColor = vec4(texture(uEnvironment, normalize(vCubeDirection)).rgb, 1.0);
    } else if (uRenderMode == 1) {
        vec3 incident = normalize(vWorldPosition - uCameraPosition);
        vec3 reflectionDirection = reflect(incident, normalize(vNormal));
        fragmentColor = vec4(texture(uEnvironment, reflectionDirection).rgb, 1.0);
    } else {
        fragmentColor = vec4(uBaseColor, 1.0);
    }
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
float gCameraAzimuthDegrees = 0.0F;
float gCameraElevationDegrees = 14.0F;
bool gSkyboxEnabled = true;
bool gReflectionEnabled = true;
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

void setUniformVec3(GLint location, const Vec3& value) {
    glUniform3f(location, value[0], value[1], value[2]);
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = std::string("Learn OpenGL - Skybox: ")
        + (gSkyboxEnabled ? "ON" : "OFF")
        + " | reflective sphere: "
        + (gReflectionEnabled ? "ON" : "OFF")
        + " | camera azimuth: "
        + std::to_string(static_cast<int>(gCameraAzimuthDegrees))
        + " deg, elevation: "
        + std::to_string(static_cast<int>(gCameraElevationDegrees))
        + " deg (arrows, S, M)";
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

    if (key == GLFW_KEY_LEFT) {
        gCameraAzimuthDegrees -= 8.0F;
    } else if (key == GLFW_KEY_RIGHT) {
        gCameraAzimuthDegrees += 8.0F;
    } else if (key == GLFW_KEY_UP) {
        gCameraElevationDegrees = std::min(gCameraElevationDegrees + 5.0F, 65.0F);
    } else if (key == GLFW_KEY_DOWN) {
        gCameraElevationDegrees = std::max(gCameraElevationDegrees - 5.0F, -65.0F);
    } else if (key == GLFW_KEY_S && action == GLFW_PRESS) {
        gSkyboxEnabled = !gSkyboxEnabled;
    } else if (key == GLFW_KEY_M && action == GLFW_PRESS) {
        gReflectionEnabled = !gReflectionEnabled;
    } else if (key == GLFW_KEY_R && action == GLFW_PRESS) {
        gCameraAzimuthDegrees = 0.0F;
        gCameraElevationDegrees = 14.0F;
        gSkyboxEnabled = true;
        gReflectionEnabled = true;
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

void appendQuad(
    std::vector<Vertex>& vertices,
    const Vec3& a,
    const Vec3& b,
    const Vec3& c,
    const Vec3& d
) {
    appendVertex(vertices, a);
    appendVertex(vertices, b);
    appendVertex(vertices, c);
    appendVertex(vertices, a);
    appendVertex(vertices, c);
    appendVertex(vertices, d);
}

std::vector<Vertex> makeSkyboxVertices() {
    std::vector<Vertex> vertices;
    vertices.reserve(36);
    appendQuad(vertices, { -1.0F, -1.0F, 1.0F }, { 1.0F, -1.0F, 1.0F },
        { 1.0F, 1.0F, 1.0F }, { -1.0F, 1.0F, 1.0F });
    appendQuad(vertices, { 1.0F, -1.0F, -1.0F }, { -1.0F, -1.0F, -1.0F },
        { -1.0F, 1.0F, -1.0F }, { 1.0F, 1.0F, -1.0F });
    appendQuad(vertices, { -1.0F, 1.0F, 1.0F }, { 1.0F, 1.0F, 1.0F },
        { 1.0F, 1.0F, -1.0F }, { -1.0F, 1.0F, -1.0F });
    appendQuad(vertices, { -1.0F, -1.0F, -1.0F }, { 1.0F, -1.0F, -1.0F },
        { 1.0F, -1.0F, 1.0F }, { -1.0F, -1.0F, 1.0F });
    appendQuad(vertices, { 1.0F, -1.0F, 1.0F }, { 1.0F, -1.0F, -1.0F },
        { 1.0F, 1.0F, -1.0F }, { 1.0F, 1.0F, 1.0F });
    appendQuad(vertices, { -1.0F, -1.0F, -1.0F }, { -1.0F, -1.0F, 1.0F },
        { -1.0F, 1.0F, 1.0F }, { -1.0F, 1.0F, -1.0F });
    return vertices;
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

std::vector<unsigned char> makeCubemapFacePixels(const Vec3& baseColor) {
    const std::size_t channelCount = 4;
    std::vector<unsigned char> pixels(
        static_cast<std::size_t>(kCubeFaceSize * kCubeFaceSize) * channelCount
    );

    for (int y = 0; y < kCubeFaceSize; ++y) {
        for (int x = 0; x < kCubeFaceSize; ++x) {
            const float u = static_cast<float>(x) / static_cast<float>(kCubeFaceSize - 1);
            const float v = static_cast<float>(y) / static_cast<float>(kCubeFaceSize - 1);
            const bool gridLine = (x % 16 == 0) || (y % 16 == 0);
            const bool centerMark = x >= 27 && x <= 36 && y >= 27 && y <= 36;
            const float gradient = 0.42F + 0.38F * u + 0.20F * v;
            const float intensity = gridLine ? gradient * 0.52F : gradient;
            const std::size_t offset = static_cast<std::size_t>(y * kCubeFaceSize + x) * channelCount;

            for (std::size_t channel = 0; channel < 3; ++channel) {
                const float value = centerMark
                    ? 1.0F
                    : std::clamp(baseColor[channel] * intensity, 0.0F, 1.0F);
                pixels[offset + channel] = static_cast<unsigned char>(std::round(value * 255.0F));
            }
            pixels[offset + 3] = 255;
        }
    }
    return pixels;
}

GLuint createCubemapTexture() {
    GLuint texture = 0;
    glGenTextures(1, &texture);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_CUBE_MAP, texture);

    for (std::size_t face = 0; face < kCubeFaceColors.size(); ++face) {
        const std::vector<unsigned char> pixels = makeCubemapFacePixels(kCubeFaceColors[face]);
        glTexImage2D(
            GL_TEXTURE_CUBE_MAP_POSITIVE_X + static_cast<GLenum>(face),
            0,
            GL_RGBA8,
            kCubeFaceSize,
            kCubeFaceSize,
            0,
            GL_RGBA,
            GL_UNSIGNED_BYTE,
            pixels.data()
        );
    }

    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glBindTexture(GL_TEXTURE_CUBE_MAP, 0);
    return texture;
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
        glGetUniformLocation(program, "uEnvironment"),
        glGetUniformLocation(program, "uRenderMode"),
        glGetUniformLocation(program, "uBaseColor"),
    };
}

bool hasRequiredUniforms(const UniformLocations& uniforms) {
    return uniforms.aspect >= 0
        && uniforms.cameraPosition >= 0
        && uniforms.environment >= 0
        && uniforms.renderMode >= 0
        && uniforms.baseColor >= 0;
}

void drawMesh(
    GLuint vertexArray,
    GLsizei vertexCount,
    const UniformLocations& uniforms,
    int renderMode,
    float aspect,
    const Vec3& cameraPosition,
    GLuint cubemapTexture
) {
    glUniform1f(uniforms.aspect, aspect);
    setUniformVec3(uniforms.cameraPosition, cameraPosition);
    setUniformVec3(uniforms.baseColor, kBaseColor);
    glUniform1i(uniforms.environment, 0);
    glUniform1i(uniforms.renderMode, renderMode);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLES, 0, vertexCount);
}

void releaseResources(
    GLuint program,
    GLuint sphereVertexBuffer,
    GLuint sphereVertexArray,
    GLuint skyboxVertexBuffer,
    GLuint skyboxVertexArray,
    GLuint cubemapTexture
) {
    if (program != 0) {
        glDeleteProgram(program);
    }
    if (sphereVertexBuffer != 0) {
        glDeleteBuffers(1, &sphereVertexBuffer);
    }
    if (sphereVertexArray != 0) {
        glDeleteVertexArrays(1, &sphereVertexArray);
    }
    if (skyboxVertexBuffer != 0) {
        glDeleteBuffers(1, &skyboxVertexBuffer);
    }
    if (skyboxVertexArray != 0) {
        glDeleteVertexArrays(1, &skyboxVertexArray);
    }
    if (cubemapTexture != 0) {
        glDeleteTextures(1, &cubemapTexture);
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
        "Learn OpenGL - Cubemap Skybox and Reflection",
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
    const std::vector<Vertex> skyboxVertices = makeSkyboxVertices();
    const GLsizei sphereVertexCount = static_cast<GLsizei>(sphereVertices.size());
    const GLsizei skyboxVertexCount = static_cast<GLsizei>(skyboxVertices.size());
    GLuint sphereVertexArray = 0;
    GLuint sphereVertexBuffer = 0;
    GLuint skyboxVertexArray = 0;
    GLuint skyboxVertexBuffer = 0;
    createMesh(sphereVertices, sphereVertexArray, sphereVertexBuffer);
    createMesh(skyboxVertices, skyboxVertexArray, skyboxVertexBuffer);
    const GLuint cubemapTexture = createCubemapTexture();

    const GLuint program = createProgram();
    if (program == 0 || cubemapTexture == 0) {
        releaseResources(
            program,
            sphereVertexBuffer,
            sphereVertexArray,
            skyboxVertexBuffer,
            skyboxVertexArray,
            cubemapTexture
        );
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glUseProgram(program);
    const UniformLocations uniforms = getUniformLocations(program);
    if (!hasRequiredUniforms(uniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(
            program,
            sphereVertexBuffer,
            sphereVertexArray,
            skyboxVertexBuffer,
            skyboxVertexArray,
            cubemapTexture
        );
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
            const float aspect = static_cast<float>(gFramebufferWidth)
                / static_cast<float>(gFramebufferHeight);
            const Vec3 cameraPosition = currentCameraPosition();
            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glClearColor(0.035F, 0.045F, 0.070F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glUseProgram(program);

            if (gSkyboxEnabled) {
                glDepthFunc(GL_LEQUAL);
                glDepthMask(GL_FALSE);
                drawMesh(
                    skyboxVertexArray,
                    skyboxVertexCount,
                    uniforms,
                    0,
                    aspect,
                    cameraPosition,
                    cubemapTexture
                );
                glDepthMask(GL_TRUE);
                glDepthFunc(GL_LESS);
            }

            drawMesh(
                sphereVertexArray,
                sphereVertexCount,
                uniforms,
                gReflectionEnabled ? 1 : 2,
                aspect,
                cameraPosition,
                cubemapTexture
            );

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(
        program,
        sphereVertexBuffer,
        sphereVertexArray,
        skyboxVertexBuffer,
        skyboxVertexArray,
        cubemapTexture
    );
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
