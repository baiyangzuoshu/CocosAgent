#pragma once

#include <cstddef>

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

class CCTextureAtlas;

class CCSprite {
public:
    CCSprite(CCTextureAtlas& atlas, unsigned int atlasIndex);
    void setTextureRect(float width, float height);
    void updateColor(ccColor4B color);
    const ccV3F_C4B_T2F_Quad& quad() const { return m_sQuad; }

private:
    ccV3F_C4B_T2F_Quad m_sQuad{};
    CCTextureAtlas& m_atlas;
    unsigned int m_uAtlasIndex;
};
