#include <cmath>
#include <iomanip>
#include <iostream>

#include "matrix_math.h"

namespace lesson {

Mat4 identityMatrix() {
    Mat4 result{};
    for (std::size_t index = 0; index < 4; ++index) {
        result.at(index, index) = 1.0F;
    }
    return result;
}

Mat4 scaleMatrix(float x, float y, float z) {
    Mat4 result = identityMatrix();
    result.at(0, 0) = x;
    result.at(1, 1) = y;
    result.at(2, 2) = z;
    return result;
}

Mat4 rotationZ90Matrix() {
    Mat4 result = identityMatrix();
    result.at(0, 0) = 0.0F;
    result.at(0, 1) = -1.0F;
    result.at(1, 0) = 1.0F;
    result.at(1, 1) = 0.0F;
    return result;
}

Mat4 translationMatrix(float x, float y, float z) {
    Mat4 result = identityMatrix();
    result.at(0, 3) = x;
    result.at(1, 3) = y;
    result.at(2, 3) = z;
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

Vec4 transform(const Mat4& matrix, const Vec4& vector) {
    const float input[4] = { vector.x, vector.y, vector.z, vector.w };
    float output[4] = {};
    for (std::size_t row = 0; row < 4; ++row) {
        for (std::size_t column = 0; column < 4; ++column) {
            output[row] += matrix.at(row, column) * input[column];
        }
    }
    return { output[0], output[1], output[2], output[3] };
}

void printVector(const char* label, const Vec4& vector) {
    std::cout << label << " = ("
              << vector.x << ", " << vector.y << ", "
              << vector.z << ", " << vector.w << ")\n";
}

} // namespace lesson
