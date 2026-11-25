#pragma once

#include <array>
#include <cstddef>

namespace lesson {

struct Mat4 {
    std::array<float, 16> values{};

    float& at(std::size_t row, std::size_t column) {
        return values[column * 4 + row];
    }
};

Mat4 perspectiveMatrix(float verticalFovRadians, float aspect, float nearPlane, float farPlane);
Mat4 orthographicMatrix(float height, float aspect, float nearPlane, float farPlane);

} // namespace lesson
