#include <cmath>

#include "camera_matrix.h"

namespace lesson {

Mat4 identityMatrix() {
    Mat4 result{};
    for (std::size_t index = 0; index < 4; ++index) {
        result.at(index, index) = 1.0F;
    }
    return result;
}

Mat4 translationMatrix(float x, float y, float z) {
    Mat4 result = identityMatrix();
    result.at(0, 3) = x;
    result.at(1, 3) = y;
    result.at(2, 3) = z;
    return result;
}

Mat4 rotationZMatrix(float radians) {
    Mat4 result = identityMatrix();
    const float cosine = std::cos(radians);
    const float sine = std::sin(radians);
    result.at(0, 0) = cosine;
    result.at(0, 1) = -sine;
    result.at(1, 0) = sine;
    result.at(1, 1) = cosine;
    return result;
}

Mat4 multiply(const Mat4& left, const Mat4& right) {
    Mat4 result{};
    for (std::size_t row = 0; row < 4; ++row) {
        for (std::size_t column = 0; column < 4; ++column) {
            for (std::size_t inner = 0; inner < 4; ++inner) {
                result.at(row, column) += left.at(row, inner) * right.at(inner, column);
            }
        }
    }
    return result;
}

} // namespace lesson
