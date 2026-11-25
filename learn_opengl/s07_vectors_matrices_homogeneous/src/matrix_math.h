#pragma once

#include <array>
#include <cstddef>

namespace lesson {

struct Vec4 {
    float x;
    float y;
    float z;
    float w;
};

struct Mat4 {
    std::array<float, 16> elements{};

    float& at(std::size_t row, std::size_t column) {
        return elements[column * 4 + row];
    }

    float at(std::size_t row, std::size_t column) const {
        return elements[column * 4 + row];
    }
};

Mat4 identityMatrix();
Mat4 scaleMatrix(float x, float y, float z);
Mat4 rotationZ90Matrix();
Mat4 translationMatrix(float x, float y, float z);
Mat4 multiply(const Mat4& left, const Mat4& right);
Vec4 transform(const Mat4& matrix, const Vec4& vector);
void printVector(const char* label, const Vec4& vector);

} // namespace lesson
