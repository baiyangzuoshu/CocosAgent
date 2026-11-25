#include <cmath>

#include "projection_matrix.h"

namespace lesson {

Mat4 perspectiveMatrix(float verticalFovRadians, float aspect, float nearPlane, float farPlane) {
    Mat4 result{};
    const float scale = 1.0F / std::tan(verticalFovRadians * 0.5F);
    result.at(0, 0) = scale / aspect;
    result.at(1, 1) = scale;
    result.at(2, 2) = (farPlane + nearPlane) / (nearPlane - farPlane);
    result.at(2, 3) = (2.0F * farPlane * nearPlane) / (nearPlane - farPlane);
    result.at(3, 2) = -1.0F;
    return result;
}

Mat4 orthographicMatrix(float height, float aspect, float nearPlane, float farPlane) {
    Mat4 result{};
    const float halfHeight = height * 0.5F;
    const float halfWidth = halfHeight * aspect;
    result.at(0, 0) = 1.0F / halfWidth;
    result.at(1, 1) = 1.0F / halfHeight;
    result.at(2, 2) = -2.0F / (farPlane - nearPlane);
    result.at(2, 3) = -(farPlane + nearPlane) / (farPlane - nearPlane);
    result.at(3, 3) = 1.0F;
    return result;
}

} // namespace lesson
