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
constexpr int kWindowHeight = 680;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kCameraDistance = 3.3F;
constexpr std::size_t kCubeVertexCount = 36;

using Vec3 = std::array<float, 3>;

struct Vertex {
    float position[3];
    float normal[3];
};

struct UniformLocations {
    GLint aspect = -1;
    GLint cameraDistance = -1;
    GLint angleX = -1;
    GLint angleY = -1;
    GLint lightDirection = -1;
    GLint shadingMode = -1;
};

const char* kVertexShaderSource = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

uniform float uAspect;
uniform float uCameraDistance;
uniform float uAngleX;
uniform float uAngleY;
out vec3 vNormal;

vec3 rotateX(vec3 value, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(value.x, c * value.y - s * value.z, s * value.y + c * value.z);
}

vec3 rotateY(vec3 value, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * value.x + s * value.z, value.y, -s * value.x + c * value.z);
}

void main() {
    vec3 worldPosition = rotateY(rotateX(aPosition, uAngleX), uAngleY);
    vNormal = rotateY(rotateX(aNormal, uAngleX), uAngleY);

    vec3 viewPosition = worldPosition - vec3(0.0, 0.0, uCameraDistance);
    const float nearPlane = 0.1;
    const float farPlane = 20.0;
    const float focalLength = 1.55;
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
in vec3 vNormal;

uniform vec3 uLightDirection;
uniform int uShadingMode;
out vec4 fragmentColor;

void main() {
    vec3 normal = normalize(vNormal);
    if (uShadingMode == 1) {
        fragmentColor = vec4(normal * 0.5 + 0.5, 1.0);
        return;
    }

    const vec3 baseColor = vec3(0.20, 0.68, 0.92);
    const float ambient = 0.16;
    float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
    vec3 color = baseColor * (ambient + 0.84 * diffuse);
    fragmentColor = vec4(color, 1.0);
}
)glsl";

int gFramebufferWidth = 0;
int gFramebufferHeight = 0;
float gLightAzimuthDegrees = -35.0F;
float gLightElevationDegrees = 35.0F;
bool gDrawable = false;

float degreesToRadians(float degrees) {
    return degrees * kPi / 180.0F;
}

Vec3 currentLightDirection() {
    const float azimuth = degreesToRadians(gLightAzimuthDegrees);
    const float elevation = degreesToRadians(gLightElevationDegrees);
    const float horizontalLength = std::cos(elevation);
    return {
        horizontalLength * std::cos(azimuth),
        std::sin(elevation),
        horizontalLength * std::sin(azimuth),
    };
}

void updateWindowTitle(GLFWwindow* window) {
    const std::string title = "Learn OpenGL - Left: Lambert diffuse / Right: normal RGB | light azimuth: "
        + std::to_string(static_cast<int>(gLightAzimuthDegrees))
        + " deg, elevation: "
        + std::to_string(static_cast<int>(gLightElevationDegrees))
        + " deg (arrows)";
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
        gLightAzimuthDegrees -= 10.0F;
    } else if (key == GLFW_KEY_RIGHT) {
        gLightAzimuthDegrees += 10.0F;
    } else if (key == GLFW_KEY_UP) {
        gLightElevationDegrees = std::min(gLightElevationDegrees + 5.0F, 75.0F);
    } else if (key == GLFW_KEY_DOWN) {
        gLightElevationDegrees = std::max(gLightElevationDegrees - 5.0F, -75.0F);
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

std::array<Vertex, kCubeVertexCount> makeCubeVertices() {
    std::array<Vertex, kCubeVertexCount> vertices{};
    std::size_t cursor = 0;
    constexpr std::array<std::size_t, 6> kTriangleIndices{ 0, 1, 2, 0, 2, 3 };
    constexpr float kHalfExtent = 0.72F;
    const float s = kHalfExtent;

    const auto addFace = [&](const Vec3& normal, const std::array<Vec3, 4>& corners) {
        for (const std::size_t cornerIndex : kTriangleIndices) {
            const Vec3& position = corners[cornerIndex];
            vertices[cursor++] = {
                { position[0], position[1], position[2] },
                { normal[0], normal[1], normal[2] },
            };
        }
    };

    addFace(Vec3{ 0.0F, 0.0F, 1.0F }, std::array<Vec3, 4>{{
        Vec3{ -s, -s,  s }, Vec3{  s, -s,  s }, Vec3{  s,  s,  s }, Vec3{ -s,  s,  s },
    }});
    addFace(Vec3{ 0.0F, 0.0F, -1.0F }, std::array<Vec3, 4>{{
        Vec3{  s, -s, -s }, Vec3{ -s, -s, -s }, Vec3{ -s,  s, -s }, Vec3{  s,  s, -s },
    }});
    addFace(Vec3{ 1.0F, 0.0F, 0.0F }, std::array<Vec3, 4>{{
        Vec3{  s, -s,  s }, Vec3{  s, -s, -s }, Vec3{  s,  s, -s }, Vec3{  s,  s,  s },
    }});
    addFace(Vec3{ -1.0F, 0.0F, 0.0F }, std::array<Vec3, 4>{{
        Vec3{ -s, -s, -s }, Vec3{ -s, -s,  s }, Vec3{ -s,  s,  s }, Vec3{ -s,  s, -s },
    }});
    addFace(Vec3{ 0.0F, 1.0F, 0.0F }, std::array<Vec3, 4>{{
        Vec3{ -s,  s,  s }, Vec3{  s,  s,  s }, Vec3{  s,  s, -s }, Vec3{ -s,  s, -s },
    }});
    addFace(Vec3{ 0.0F, -1.0F, 0.0F }, std::array<Vec3, 4>{{
        Vec3{ -s, -s, -s }, Vec3{  s, -s, -s }, Vec3{  s, -s,  s }, Vec3{ -s, -s,  s },
    }});

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
    const std::array<Vertex, kCubeVertexCount>& vertices,
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

void drawCube(
    GLuint vertexArray,
    const UniformLocations& uniforms,
    float aspect,
    float angleX,
    float angleY,
    const Vec3& lightDirection,
    int shadingMode
) {
    glUniform1f(uniforms.aspect, aspect);
    glUniform1f(uniforms.cameraDistance, kCameraDistance);
    glUniform1f(uniforms.angleX, angleX);
    glUniform1f(uniforms.angleY, angleY);
    glUniform3f(uniforms.lightDirection, lightDirection[0], lightDirection[1], lightDirection[2]);
    glUniform1i(uniforms.shadingMode, shadingMode);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(kCubeVertexCount));
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
        "Learn OpenGL - Left: Lambert diffuse / Right: normal RGB",
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

    const auto cubeVertices = makeCubeVertices();
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    createMesh(cubeVertices, vertexArray, vertexBuffer);

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
        glGetUniformLocation(program, "uCameraDistance"),
        glGetUniformLocation(program, "uAngleX"),
        glGetUniformLocation(program, "uAngleY"),
        glGetUniformLocation(program, "uLightDirection"),
        glGetUniformLocation(program, "uShadingMode"),
    };
    if (uniforms.aspect < 0 || uniforms.cameraDistance < 0 || uniforms.angleX < 0
        || uniforms.angleY < 0 || uniforms.lightDirection < 0 || uniforms.shadingMode < 0) {
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
            const float time = static_cast<float>(glfwGetTime());
            const float angleX = time * 0.47F;
            const float angleY = time * 0.72F;
            const Vec3 lightDirection = currentLightDirection();

            glViewport(0, 0, gFramebufferWidth, gFramebufferHeight);
            glClearColor(0.035F, 0.045F, 0.065F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glUseProgram(program);

            glViewport(0, 0, leftWidth, gFramebufferHeight);
            drawCube(
                vertexArray,
                uniforms,
                static_cast<float>(leftWidth) / static_cast<float>(gFramebufferHeight),
                angleX,
                angleY,
                lightDirection,
                0
            );

            glViewport(leftWidth, 0, rightWidth, gFramebufferHeight);
            drawCube(
                vertexArray,
                uniforms,
                static_cast<float>(rightWidth) / static_cast<float>(gFramebufferHeight),
                angleX,
                angleY,
                lightDirection,
                1
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
