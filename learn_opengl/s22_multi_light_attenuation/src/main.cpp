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
constexpr float kDefaultRange = 3.8F;
constexpr float kDefaultSpotOuterDegrees = 64.0F;

using Vec3 = std::array<float, 3>;

struct Vertex {
    float position[3];
    float normal[3];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint cameraPosition = -1;
    GLint baseColor = -1;
    GLint ambientColor = -1;
    GLint specularStrength = -1;
    GLint shininess = -1;
    GLint directionalDirection = -1;
    GLint directionalColor = -1;
    GLint pointPosition = -1;
    GLint pointColor = -1;
    GLint spotPosition = -1;
    GLint spotDirection = -1;
    GLint spotColor = -1;
    GLint localLightRange = -1;
    GLint spotInnerCos = -1;
    GLint spotOuterCos = -1;
    GLint directionalEnabled = -1;
    GLint pointEnabled = -1;
    GLint spotEnabled = -1;
};

constexpr Vec3 kBaseColor{ 0.30F, 0.52F, 0.76F };
constexpr Vec3 kAmbientColor{ 0.050F, 0.055F, 0.070F };
constexpr float kSpecularStrength = 0.38F;
constexpr float kShininess = 36.0F;

constexpr Vec3 kDirectionalLightDirection{ -0.35F, 0.78F, 0.52F };
constexpr Vec3 kDirectionalLightColor{ 0.40F, 0.48F, 0.72F };
constexpr Vec3 kPointLightPosition{ -1.55F, 0.62F, 1.65F };
constexpr Vec3 kPointLightColor{ 0.88F, 0.34F, 0.12F };
constexpr Vec3 kSpotLightPosition{ 1.50F, 0.72F, 1.65F };
constexpr Vec3 kSpotLightColor{ 0.16F, 0.78F, 0.48F };

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
uniform vec3 uBaseColor;
uniform vec3 uAmbientColor;
uniform float uSpecularStrength;
uniform float uShininess;

uniform vec3 uDirectionalDirection;
uniform vec3 uDirectionalColor;
uniform vec3 uPointPosition;
uniform vec3 uPointColor;
uniform vec3 uSpotPosition;
uniform vec3 uSpotDirection;
uniform vec3 uSpotColor;
uniform float uLocalLightRange;
uniform float uSpotInnerCos;
uniform float uSpotOuterCos;
uniform int uDirectionalEnabled;
uniform int uPointEnabled;
uniform int uSpotEnabled;

out vec4 fragmentColor;

float rangeAttenuation(float distanceToLight, float range) {
    float normalizedDistance = distanceToLight / range;
    return clamp(1.0 - normalizedDistance * normalizedDistance, 0.0, 1.0);
}

vec3 directLightContribution(vec3 normal, vec3 viewDirection, vec3 lightDirection, vec3 lightColor, float attenuation) {
    float normalLight = max(dot(normal, lightDirection), 0.0);
    float specular = 0.0;
    if (normalLight > 0.0) {
        vec3 reflectedDirection = reflect(-lightDirection, normal);
        specular = pow(max(dot(reflectedDirection, viewDirection), 0.0), uShininess);
    }

    vec3 diffuseColor = uBaseColor * lightColor * normalLight;
    vec3 specularColor = lightColor * specular * uSpecularStrength;
    return (diffuseColor + specularColor) * attenuation;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    vec3 color = uBaseColor * uAmbientColor;

    if (uDirectionalEnabled != 0) {
        vec3 lightDirection = normalize(uDirectionalDirection);
        color += directLightContribution(
            normal, viewDirection, lightDirection, uDirectionalColor, 1.0
        );
    }

    if (uPointEnabled != 0) {
        vec3 toLight = uPointPosition - vWorldPosition;
        float distanceToLight = length(toLight);
        vec3 lightDirection = toLight / max(distanceToLight, 0.0001);
        float attenuation = rangeAttenuation(distanceToLight, uLocalLightRange);
        color += directLightContribution(
            normal, viewDirection, lightDirection, uPointColor, attenuation
        );
    }

    if (uSpotEnabled != 0) {
        vec3 fromLightToFragment = vWorldPosition - uSpotPosition;
        float distanceToLight = length(fromLightToFragment);
        vec3 fromLightDirection = fromLightToFragment / max(distanceToLight, 0.0001);
        vec3 lightDirection = -fromLightDirection;
        float range = rangeAttenuation(distanceToLight, uLocalLightRange);
        float coneCos = dot(fromLightDirection, normalize(uSpotDirection));
        float cone = smoothstep(uSpotOuterCos, uSpotInnerCos, coneCos);
        color += directLightContribution(
            normal, viewDirection, lightDirection, uSpotColor, range * cone
        );
    }

    fragmentColor = vec4(color, 1.0);
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
float gCameraAzimuthDegrees = 0.0F;
float gCameraElevationDegrees = 15.0F;
float gLocalLightRange = kDefaultRange;
float gSpotOuterDegrees = kDefaultSpotOuterDegrees;
bool gDirectionalEnabled = true;
bool gPointEnabled = true;
bool gSpotEnabled = true;
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

Vec3 currentSpotDirection() {
    return normalize(Vec3{
        -kSpotLightPosition[0],
        -kSpotLightPosition[1],
        -kSpotLightPosition[2],
    });
}

void setUniformVec3(GLint location, const Vec3& value) {
    glUniform3f(location, value[0], value[1], value[2]);
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = std::string("Learn OpenGL - Lights D/P/S: ")
        + (gDirectionalEnabled ? "ON" : "OFF") + "/"
        + (gPointEnabled ? "ON" : "OFF") + "/"
        + (gSpotEnabled ? "ON" : "OFF")
        + " | range: " + std::to_string(static_cast<int>(gLocalLightRange * 10.0F) / 10.0F)
        + " | spot outer: " + std::to_string(static_cast<int>(gSpotOuterDegrees))
        + " deg (1-3, [ ], Q/E, arrows)";
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
    } else if (key == GLFW_KEY_1 && action == GLFW_PRESS) {
        gDirectionalEnabled = !gDirectionalEnabled;
    } else if (key == GLFW_KEY_2 && action == GLFW_PRESS) {
        gPointEnabled = !gPointEnabled;
    } else if (key == GLFW_KEY_3 && action == GLFW_PRESS) {
        gSpotEnabled = !gSpotEnabled;
    } else if (key == GLFW_KEY_LEFT_BRACKET) {
        gLocalLightRange = std::max(gLocalLightRange - 0.25F, 1.5F);
    } else if (key == GLFW_KEY_RIGHT_BRACKET) {
        gLocalLightRange = std::min(gLocalLightRange + 0.25F, 6.0F);
    } else if (key == GLFW_KEY_Q) {
        gSpotOuterDegrees = std::max(gSpotOuterDegrees - 4.0F, 20.0F);
    } else if (key == GLFW_KEY_E) {
        gSpotOuterDegrees = std::min(gSpotOuterDegrees + 4.0F, 100.0F);
    } else if (key == GLFW_KEY_R) {
        gCameraAzimuthDegrees = 0.0F;
        gCameraElevationDegrees = 15.0F;
        gLocalLightRange = kDefaultRange;
        gSpotOuterDegrees = kDefaultSpotOuterDegrees;
        gDirectionalEnabled = true;
        gPointEnabled = true;
        gSpotEnabled = true;
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
        glGetUniformLocation(program, "uBaseColor"),
        glGetUniformLocation(program, "uAmbientColor"),
        glGetUniformLocation(program, "uSpecularStrength"),
        glGetUniformLocation(program, "uShininess"),
        glGetUniformLocation(program, "uDirectionalDirection"),
        glGetUniformLocation(program, "uDirectionalColor"),
        glGetUniformLocation(program, "uPointPosition"),
        glGetUniformLocation(program, "uPointColor"),
        glGetUniformLocation(program, "uSpotPosition"),
        glGetUniformLocation(program, "uSpotDirection"),
        glGetUniformLocation(program, "uSpotColor"),
        glGetUniformLocation(program, "uLocalLightRange"),
        glGetUniformLocation(program, "uSpotInnerCos"),
        glGetUniformLocation(program, "uSpotOuterCos"),
        glGetUniformLocation(program, "uDirectionalEnabled"),
        glGetUniformLocation(program, "uPointEnabled"),
        glGetUniformLocation(program, "uSpotEnabled"),
    };
}

bool hasRequiredUniforms(const UniformLocations& uniforms) {
    const GLint locations[] = {
        uniforms.aspect,
        uniforms.cameraPosition,
        uniforms.baseColor,
        uniforms.ambientColor,
        uniforms.specularStrength,
        uniforms.shininess,
        uniforms.directionalDirection,
        uniforms.directionalColor,
        uniforms.pointPosition,
        uniforms.pointColor,
        uniforms.spotPosition,
        uniforms.spotDirection,
        uniforms.spotColor,
        uniforms.localLightRange,
        uniforms.spotInnerCos,
        uniforms.spotOuterCos,
        uniforms.directionalEnabled,
        uniforms.pointEnabled,
        uniforms.spotEnabled,
    };
    for (const GLint location : locations) {
        if (location < 0) {
            return false;
        }
    }
    return true;
}

void drawSphere(
    GLuint vertexArray,
    GLsizei vertexCount,
    const UniformLocations& uniforms,
    float aspect,
    const Vec3& cameraPosition
) {
    setUniformVec3(uniforms.baseColor, kBaseColor);
    setUniformVec3(uniforms.ambientColor, kAmbientColor);
    setUniformVec3(uniforms.cameraPosition, cameraPosition);
    setUniformVec3(uniforms.directionalDirection, normalize(kDirectionalLightDirection));
    setUniformVec3(uniforms.directionalColor, kDirectionalLightColor);
    setUniformVec3(uniforms.pointPosition, kPointLightPosition);
    setUniformVec3(uniforms.pointColor, kPointLightColor);
    setUniformVec3(uniforms.spotPosition, kSpotLightPosition);
    setUniformVec3(uniforms.spotDirection, currentSpotDirection());
    setUniformVec3(uniforms.spotColor, kSpotLightColor);
    glUniform1f(uniforms.aspect, aspect);
    glUniform1f(uniforms.specularStrength, kSpecularStrength);
    glUniform1f(uniforms.shininess, kShininess);
    glUniform1f(uniforms.localLightRange, gLocalLightRange);

    const float outerHalfAngle = degreesToRadians(gSpotOuterDegrees * 0.5F);
    const float innerHalfAngle = outerHalfAngle * 0.70F;
    glUniform1f(uniforms.spotOuterCos, std::cos(outerHalfAngle));
    glUniform1f(uniforms.spotInnerCos, std::cos(innerHalfAngle));
    glUniform1i(uniforms.directionalEnabled, gDirectionalEnabled ? 1 : 0);
    glUniform1i(uniforms.pointEnabled, gPointEnabled ? 1 : 0);
    glUniform1i(uniforms.spotEnabled, gSpotEnabled ? 1 : 0);

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
        "Learn OpenGL - Multiple Lights and Attenuation",
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
    updateWindowTitle(window);

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        if (gDrawable) {
            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glClearColor(0.025F, 0.032F, 0.050F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            glUseProgram(program);
            drawSphere(
                vertexArray,
                sphereVertexCount,
                uniforms,
                static_cast<float>(gFramebufferWidth) / static_cast<float>(gFramebufferHeight),
                currentCameraPosition()
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
