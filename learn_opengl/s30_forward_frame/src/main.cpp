#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <sstream>
#include <vector>

namespace {

constexpr int kWindowWidth = 1180;
constexpr int kWindowHeight = 820;
constexpr int kIndexCount = 36;
constexpr float kPi = 3.14159265358979323846F;
constexpr float kDegreesToRadians = kPi / 180.0F;
constexpr float kFieldOfView = 60.0F * kDegreesToRadians;
constexpr float kNearPlane = 0.1F;
constexpr float kFarPlane = 80.0F;

struct Vec3 {
    float x = 0.0F;
    float y = 0.0F;
    float z = 0.0F;
};

struct Mat4 {
    std::array<float, 16> values{};
};

struct Vertex {
    float position[3];
    float normal[3];
};

struct SceneObject {
    Vec3 position;
    float scale = 1.0F;
    Vec3 color;
    float rotationOffset = 0.0F;
    float rotationSpeed = 1.0F;
};

struct Camera {
    Vec3 position{ 0.0F, 3.0F, 9.0F };
    float yaw = -90.0F;
    float pitch = -13.0F;
};

struct Uniforms {
    GLint model = -1;
    GLint view = -1;
    GLint projection = -1;
    GLint baseColor = -1;
    GLint lightDirection = -1;
    GLint cameraPosition = -1;
};

struct VisibleObject {
    std::size_t index = 0;
    float cameraDepth = 0.0F;
};

constexpr int kObjectCount = 6;
const std::array<SceneObject, kObjectCount> kSceneObjects = {{
    { { -2.35F, -0.05F,  0.10F }, 0.76F, { 0.12F, 0.66F, 0.88F }, 0.20F,  0.70F },
    { { -1.12F,  0.15F, -0.85F }, 0.88F, { 0.91F, 0.28F, 0.15F }, 1.10F, -0.55F },
    { {  0.00F,  0.22F,  0.15F }, 1.10F, { 0.96F, 0.63F, 0.12F }, 0.00F,  0.42F },
    { {  1.28F, -0.10F, -0.80F }, 0.84F, { 0.25F, 0.75F, 0.36F }, 0.60F, -0.62F },
    { {  2.35F,  0.05F,  0.10F }, 0.73F, { 0.58F, 0.30F, 0.86F }, 1.70F,  0.82F },
    { {  0.10F,  1.45F, -2.10F }, 0.64F, { 0.90F, 0.27F, 0.56F }, 2.30F, -0.78F },
}};
const char* kVertexShader = R"glsl(
#version 330 core
layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vWorldPosition;
out vec3 vNormal;

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uProjection * uView * worldPosition;
}
)glsl";

const char* kFragmentShader = R"glsl(
#version 330 core
in vec3 vWorldPosition;
in vec3 vNormal;

uniform vec3 uBaseColor;
uniform vec3 uLightDirection;
uniform vec3 uCameraPosition;
out vec4 fragmentColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(uLightDirection);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    vec3 halfDirection = normalize(lightDirection + viewDirection);

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float specular = pow(max(dot(normal, halfDirection), 0.0), 28.0);
    vec3 linearColor = uBaseColor * (0.16 + 0.78 * diffuse)
        + vec3(0.24) * specular;
    vec3 displayColor = pow(max(linearColor, vec3(0.0)), vec3(1.0 / 2.2));
    fragmentColor = vec4(displayColor, 1.0);
}
)glsl";

int gWindowWidth = 0;
int gWindowHeight = 0;
bool gDrawable = false;
bool gPaused = false;
bool gFrustumCulling = true;
bool gFaceCulling = true;
bool gDepthTest = true;
bool gWireframe = false;
int gVisibleCount = kObjectCount;
float gRotationAngle = 0.0F;
Camera gCamera;

Vec3 add(Vec3 a, Vec3 b) {
    return { a.x + b.x, a.y + b.y, a.z + b.z };
}

Vec3 subtract(Vec3 a, Vec3 b) {
    return { a.x - b.x, a.y - b.y, a.z - b.z };
}

Vec3 multiply(Vec3 v, float scalar) {
    return { v.x * scalar, v.y * scalar, v.z * scalar };
}

float dot(Vec3 a, Vec3 b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

Vec3 cross(Vec3 a, Vec3 b) {
    return {
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x,
    };
}

Vec3 normalize(Vec3 value) {
    const float length = std::sqrt(dot(value, value));
    if (length <= 0.00001F) return {};
    return multiply(value, 1.0F / length);
}

Vec3 cameraForward(const Camera& camera) {
    const float yaw = camera.yaw * kDegreesToRadians;
    const float pitch = camera.pitch * kDegreesToRadians;
    return normalize({
        std::cos(yaw) * std::cos(pitch),
        std::sin(pitch),
        std::sin(yaw) * std::cos(pitch),
    });
}

Vec3 cameraRight(const Camera& camera) {
    return normalize(cross(cameraForward(camera), { 0.0F, 1.0F, 0.0F }));
}

Vec3 cameraUp(const Camera& camera) {
    return normalize(cross(cameraRight(camera), cameraForward(camera)));
}

Mat4 identityMatrix() {
    Mat4 result;
    result.values[0] = 1.0F;
    result.values[5] = 1.0F;
    result.values[10] = 1.0F;
    result.values[15] = 1.0F;
    return result;
}

Mat4 multiply(const Mat4& a, const Mat4& b) {
    Mat4 result;
    for (int column = 0; column < 4; ++column) {
        for (int row = 0; row < 4; ++row) {
            for (int k = 0; k < 4; ++k) {
                result.values[column * 4 + row] += a.values[k * 4 + row] * b.values[column * 4 + k];
            }
        }
    }
    return result;
}

Mat4 translationMatrix(Vec3 position) {
    Mat4 result = identityMatrix();
    result.values[12] = position.x;
    result.values[13] = position.y;
    result.values[14] = position.z;
    return result;
}

Mat4 scaleMatrix(float scale) {
    Mat4 result = identityMatrix();
    result.values[0] = scale;
    result.values[5] = scale;
    result.values[10] = scale;
    return result;
}

Mat4 rotationYMatrix(float angle) {
    Mat4 result = identityMatrix();
    const float cosine = std::cos(angle);
    const float sine = std::sin(angle);
    result.values[0] = cosine;
    result.values[2] = -sine;
    result.values[8] = sine;
    result.values[10] = cosine;
    return result;
}

Mat4 makeModelMatrix(const SceneObject& object, float angle) {
    const Mat4 translated = translationMatrix(object.position);
    const Mat4 rotated = rotationYMatrix(angle * object.rotationSpeed + object.rotationOffset);
    const Mat4 scaled = scaleMatrix(object.scale);
    return multiply(multiply(translated, rotated), scaled);
}

Mat4 lookAtMatrix(Vec3 eye, Vec3 center, Vec3 worldUp) {
    const Vec3 forward = normalize(subtract(center, eye));
    const Vec3 right = normalize(cross(forward, worldUp));
    const Vec3 up = cross(right, forward);
    Mat4 result = identityMatrix();

    result.values[0] = right.x;
    result.values[4] = right.y;
    result.values[8] = right.z;
    result.values[12] = -dot(right, eye);
    result.values[1] = up.x;
    result.values[5] = up.y;
    result.values[9] = up.z;
    result.values[13] = -dot(up, eye);
    result.values[2] = -forward.x;
    result.values[6] = -forward.y;
    result.values[10] = -forward.z;
    result.values[14] = dot(forward, eye);
    return result;
}

Mat4 perspectiveMatrix(float verticalFov, float aspect, float nearPlane, float farPlane) {
    const float focalLength = 1.0F / std::tan(verticalFov * 0.5F);
    Mat4 result;
    result.values[0] = focalLength / aspect;
    result.values[5] = focalLength;
    result.values[10] = (farPlane + nearPlane) / (nearPlane - farPlane);
    result.values[11] = -1.0F;
    result.values[14] = (2.0F * farPlane * nearPlane) / (nearPlane - farPlane);
    return result;
}

std::vector<VisibleObject> collectVisibleObjects(const Camera& camera, float aspect) {
    std::vector<VisibleObject> visible;
    visible.reserve(kSceneObjects.size());

    const Vec3 forward = cameraForward(camera);
    const Vec3 right = cameraRight(camera);
    const Vec3 up = cameraUp(camera);
    const float halfHeightSlope = std::tan(kFieldOfView * 0.5F);
    const float halfWidthSlope = halfHeightSlope * aspect;
    const float horizontalRadiusScale = std::sqrt(1.0F + halfWidthSlope * halfWidthSlope);
    const float verticalRadiusScale = std::sqrt(1.0F + halfHeightSlope * halfHeightSlope);

    for (std::size_t index = 0; index < kSceneObjects.size(); ++index) {
        const SceneObject& object = kSceneObjects[index];
        const Vec3 relative = subtract(object.position, camera.position);
        const float depth = dot(relative, forward);
        const float horizontal = dot(relative, right);
        const float vertical = dot(relative, up);
        const float radius = object.scale * 0.87F;

        bool isVisible = true;
        if (gFrustumCulling) {
            isVisible = depth + radius >= kNearPlane
                && depth - radius <= kFarPlane
                && std::fabs(horizontal) <= depth * halfWidthSlope + radius * horizontalRadiusScale
                && std::fabs(vertical) <= depth * halfHeightSlope + radius * verticalRadiusScale;
        }

        if (isVisible) {
            visible.push_back({ index, depth });
        }
    }

    std::sort(visible.begin(), visible.end(), [](const VisibleObject& a, const VisibleObject& b) {
        return a.cameraDepth < b.cameraDepth;
    });
    return visible;
}

Uniforms getUniforms(GLuint program) {
    return {
        glGetUniformLocation(program, "uModel"),
        glGetUniformLocation(program, "uView"),
        glGetUniformLocation(program, "uProjection"),
        glGetUniformLocation(program, "uBaseColor"),
        glGetUniformLocation(program, "uLightDirection"),
        glGetUniformLocation(program, "uCameraPosition"),
    };
}

bool hasRequiredUniforms(const Uniforms& uniforms) {
    return uniforms.model >= 0
        && uniforms.view >= 0
        && uniforms.projection >= 0
        && uniforms.baseColor >= 0
        && uniforms.lightDirection >= 0
        && uniforms.cameraPosition >= 0;
}

void updateWindowTitle(GLFWwindow* window) {
    std::ostringstream title;
    title << "Learn OpenGL - forward frame | objects " << gVisibleCount << '/' << kObjectCount
          << " | draw calls " << gVisibleCount
          << " | frustum " << (gFrustumCulling ? "on" : "off")
          << " | depth " << (gDepthTest ? "on" : "off")
          << " | cull " << (gFaceCulling ? "on" : "off")
          << " | " << (gWireframe ? "wire" : "fill")
          << " (WASD/QE, arrows, Space, F/C/Z/P, R)";
    glfwSetWindowTitle(window, title.str().c_str());
}

void framebufferSizeCallback(GLFWwindow* window, int width, int height) {
    gWindowWidth = width;
    gWindowHeight = height;
    gDrawable = width > 0 && height > 0;
    updateWindowTitle(window);
}

void resetState(GLFWwindow* window) {
    gCamera = Camera{};
    gPaused = false;
    gFrustumCulling = true;
    gFaceCulling = true;
    gDepthTest = true;
    gWireframe = false;
    gRotationAngle = 0.0F;
    updateWindowTitle(window);
}

void keyCallback(GLFWwindow* window, int key, int, int action, int) {
    if (action != GLFW_PRESS) return;

    if (key == GLFW_KEY_ESCAPE) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    } else if (key == GLFW_KEY_SPACE) {
        gPaused = !gPaused;
        updateWindowTitle(window);
    } else if (key == GLFW_KEY_F) {
        gFrustumCulling = !gFrustumCulling;
        updateWindowTitle(window);
    } else if (key == GLFW_KEY_C) {
        gFaceCulling = !gFaceCulling;
        updateWindowTitle(window);
    } else if (key == GLFW_KEY_Z) {
        gDepthTest = !gDepthTest;
        updateWindowTitle(window);
    } else if (key == GLFW_KEY_P) {
        gWireframe = !gWireframe;
        updateWindowTitle(window);
    } else if (key == GLFW_KEY_R) {
        resetState(window);
    }
}

void processInput(GLFWwindow* window, float deltaTime) {
    const float movement = 3.5F * deltaTime;
    const float rotation = 68.0F * deltaTime;
    const Vec3 forward = cameraForward(gCamera);
    const Vec3 right = cameraRight(gCamera);

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) gCamera.position = add(gCamera.position, multiply(forward, movement));
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) gCamera.position = subtract(gCamera.position, multiply(forward, movement));
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) gCamera.position = add(gCamera.position, multiply(right, movement));
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) gCamera.position = subtract(gCamera.position, multiply(right, movement));
    if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS) gCamera.position.y += movement;
    if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS) gCamera.position.y -= movement;

    if (glfwGetKey(window, GLFW_KEY_RIGHT) == GLFW_PRESS) gCamera.yaw += rotation;
    if (glfwGetKey(window, GLFW_KEY_LEFT) == GLFW_PRESS) gCamera.yaw -= rotation;
    if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS) gCamera.pitch += rotation;
    if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS) gCamera.pitch -= rotation;
    gCamera.pitch = std::clamp(gCamera.pitch, -85.0F, 85.0F);
}

std::array<Vertex, 24> makeCubeVertices() {
    return {{
        {{ -0.5F, -0.5F,  0.5F }, {  0.0F,  0.0F,  1.0F }},
        {{  0.5F, -0.5F,  0.5F }, {  0.0F,  0.0F,  1.0F }},
        {{  0.5F,  0.5F,  0.5F }, {  0.0F,  0.0F,  1.0F }},
        {{ -0.5F,  0.5F,  0.5F }, {  0.0F,  0.0F,  1.0F }},

        {{  0.5F, -0.5F, -0.5F }, {  0.0F,  0.0F, -1.0F }},
        {{ -0.5F, -0.5F, -0.5F }, {  0.0F,  0.0F, -1.0F }},
        {{ -0.5F,  0.5F, -0.5F }, {  0.0F,  0.0F, -1.0F }},
        {{  0.5F,  0.5F, -0.5F }, {  0.0F,  0.0F, -1.0F }},

        {{  0.5F, -0.5F,  0.5F }, {  1.0F,  0.0F,  0.0F }},
        {{  0.5F, -0.5F, -0.5F }, {  1.0F,  0.0F,  0.0F }},
        {{  0.5F,  0.5F, -0.5F }, {  1.0F,  0.0F,  0.0F }},
        {{  0.5F,  0.5F,  0.5F }, {  1.0F,  0.0F,  0.0F }},

        {{ -0.5F, -0.5F, -0.5F }, { -1.0F,  0.0F,  0.0F }},
        {{ -0.5F, -0.5F,  0.5F }, { -1.0F,  0.0F,  0.0F }},
        {{ -0.5F,  0.5F,  0.5F }, { -1.0F,  0.0F,  0.0F }},
        {{ -0.5F,  0.5F, -0.5F }, { -1.0F,  0.0F,  0.0F }},

        {{ -0.5F,  0.5F,  0.5F }, {  0.0F,  1.0F,  0.0F }},
        {{  0.5F,  0.5F,  0.5F }, {  0.0F,  1.0F,  0.0F }},
        {{  0.5F,  0.5F, -0.5F }, {  0.0F,  1.0F,  0.0F }},
        {{ -0.5F,  0.5F, -0.5F }, {  0.0F,  1.0F,  0.0F }},

        {{ -0.5F, -0.5F, -0.5F }, {  0.0F, -1.0F,  0.0F }},
        {{  0.5F, -0.5F, -0.5F }, {  0.0F, -1.0F,  0.0F }},
        {{  0.5F, -0.5F,  0.5F }, {  0.0F, -1.0F,  0.0F }},
        {{ -0.5F, -0.5F,  0.5F }, {  0.0F, -1.0F,  0.0F }},
    }};
}

std::array<unsigned int, kIndexCount> makeCubeIndices() {
    return {{
        0, 1, 2, 0, 2, 3,
        4, 5, 6, 4, 6, 7,
        8, 9, 10, 8, 10, 11,
        12, 13, 14, 12, 14, 15,
        16, 17, 18, 16, 18, 19,
        20, 21, 22, 20, 22, 23,
    }};
}

void createCubeMesh(
    const std::array<Vertex, 24>& vertices,
    const std::array<unsigned int, kIndexCount>& indices,
    GLuint& vertexArray,
    GLuint& vertexBuffer,
    GLuint& indexBuffer
) {
    glGenVertexArrays(1, &vertexArray);
    glGenBuffers(1, &vertexBuffer);
    glGenBuffers(1, &indexBuffer);
    glBindVertexArray(vertexArray);

    glBindBuffer(GL_ARRAY_BUFFER, vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices.data(), GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex),
        reinterpret_cast<const void*>(offsetof(Vertex, position)));
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex),
        reinterpret_cast<const void*>(offsetof(Vertex, normal)));
    glEnableVertexAttribArray(1);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, indexBuffer);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices.data(), GL_STATIC_DRAW);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
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
            std::vector<char> log(static_cast<std::size_t>(logLength), '\0');
            GLsizei written = 0;
            glGetShaderInfoLog(shader, logLength, &written, log.data());
            std::cerr << "Shader compilation failed:\n" << log.data() << '\n';
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
            std::vector<char> log(static_cast<std::size_t>(logLength), '\0');
            GLsizei written = 0;
            glGetProgramInfoLog(program, logLength, &written, log.data());
            std::cerr << "Program link failed:\n" << log.data() << '\n';
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

void releaseResources(GLuint program, GLuint vertexArray, GLuint vertexBuffer, GLuint indexBuffer) {
    if (program != 0) glDeleteProgram(program);
    if (vertexArray != 0) glDeleteVertexArrays(1, &vertexArray);
    if (vertexBuffer != 0) glDeleteBuffers(1, &vertexBuffer);
    if (indexBuffer != 0) glDeleteBuffers(1, &indexBuffer);
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
        "Learn OpenGL - forward frame", nullptr, nullptr);
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

    const GLuint program = createProgram(kVertexShader, kFragmentShader);
    const std::array<Vertex, 24> vertices = makeCubeVertices();
    const std::array<unsigned int, kIndexCount> indices = makeCubeIndices();
    GLuint vertexArray = 0;
    GLuint vertexBuffer = 0;
    GLuint indexBuffer = 0;
    createCubeMesh(vertices, indices, vertexArray, vertexBuffer, indexBuffer);

    if (program == 0) {
        releaseResources(program, vertexArray, vertexBuffer, indexBuffer);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    const Uniforms uniforms = getUniforms(program);
    if (!hasRequiredUniforms(uniforms)) {
        std::cerr << "A required shader uniform was not found\n";
        releaseResources(program, vertexArray, vertexBuffer, indexBuffer);
        glfwDestroyWindow(window);
        glfwTerminate();
        return 1;
    }

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glEnable(GL_CULL_FACE);
    glCullFace(GL_BACK);
    glFrontFace(GL_CCW);
    glDisable(GL_FRAMEBUFFER_SRGB);
    double previousTime = glfwGetTime();

    while (glfwWindowShouldClose(window) == GLFW_FALSE) {
        const double currentTime = glfwGetTime();
        const float deltaTime = static_cast<float>(std::min(currentTime - previousTime, 0.05));
        previousTime = currentTime;
        processInput(window, deltaTime);
        if (!gPaused) {
            gRotationAngle += deltaTime * 0.72F;
            if (gRotationAngle >= 2.0F * kPi) gRotationAngle -= 2.0F * kPi;
        }

        if (gDrawable) {
            const float aspect = static_cast<float>(gWindowWidth) / static_cast<float>(gWindowHeight);
            const std::vector<VisibleObject> visible = collectVisibleObjects(gCamera, aspect);
            if (static_cast<int>(visible.size()) != gVisibleCount) {
                gVisibleCount = static_cast<int>(visible.size());
                updateWindowTitle(window);
            }

            glBindFramebuffer(GL_FRAMEBUFFER, 0);
            glViewport(0, 0, gWindowWidth, gWindowHeight);
            glClearColor(0.035F, 0.047F, 0.075F, 1.0F);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            if (gDepthTest) glEnable(GL_DEPTH_TEST); else glDisable(GL_DEPTH_TEST);
            if (gFaceCulling) glEnable(GL_CULL_FACE); else glDisable(GL_CULL_FACE);
            glCullFace(GL_BACK);
            glFrontFace(GL_CCW);
            glPolygonMode(GL_FRONT_AND_BACK, gWireframe ? GL_LINE : GL_FILL);

            const Vec3 forward = cameraForward(gCamera);
            const Mat4 view = lookAtMatrix(gCamera.position, add(gCamera.position, forward), { 0.0F, 1.0F, 0.0F });
            const Mat4 projection = perspectiveMatrix(kFieldOfView, aspect, kNearPlane, kFarPlane);
            const Vec3 lightDirection = normalize({ -0.42F, 0.82F, 0.38F });

            glUseProgram(program);
            glUniformMatrix4fv(uniforms.view, 1, GL_FALSE, view.values.data());
            glUniformMatrix4fv(uniforms.projection, 1, GL_FALSE, projection.values.data());
            glUniform3f(uniforms.lightDirection, lightDirection.x, lightDirection.y, lightDirection.z);
            glUniform3f(uniforms.cameraPosition,
                gCamera.position.x, gCamera.position.y, gCamera.position.z);
            glBindVertexArray(vertexArray);

            for (const VisibleObject& entry : visible) {
                const SceneObject& object = kSceneObjects[entry.index];
                const Mat4 model = makeModelMatrix(object, gRotationAngle);
                glUniformMatrix4fv(uniforms.model, 1, GL_FALSE, model.values.data());
                glUniform3f(uniforms.baseColor, object.color.x, object.color.y, object.color.z);
                glDrawElements(GL_TRIANGLES, kIndexCount, GL_UNSIGNED_INT, nullptr);
            }

            glfwSwapBuffers(window);
        }
        glfwPollEvents();
    }

    releaseResources(program, vertexArray, vertexBuffer, indexBuffer);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
