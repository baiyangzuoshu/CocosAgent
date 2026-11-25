#pragma once

#include <array>
#include <cstddef>

namespace lesson {

struct Mat4 {
    std::array<float, 16> values{};

    float& at(std::size_t row, std::size_t column) {
        return values[column * 4 + row];
    }

    float at(std::size_t row, std::size_t column) const {
        return values[column * 4 + row];
    }
};

Mat4 identityMatrix();
Mat4 translationMatrix(float x, float y, float z);
Mat4 rotationZMatrix(float radians);
Mat4 multiply(const Mat4& left, const Mat4& right);

} // namespace lesson
