#pragma once

#include <iostream>

struct ccVertex3F { float x, y, z; };
struct ccColor4B { unsigned char r, g, b, a; };
struct ccTex2F { float u, v; };
struct ccV3F_C4B_T2F {
    ccVertex3F vertices;
    ccColor4B colors;
    ccTex2F texCoords;
};
struct ccV3F_C4B_T2F_Quad {
    ccV3F_C4B_T2F bl, br, tl, tr;
};

class CCSprite {
public:
    CCSprite();
    void setTextureRect(float width, float height);
    void updateColor(ccColor4B color);
    void draw() const;

private:
    ccV3F_C4B_T2F_Quad m_sQuad;
};
