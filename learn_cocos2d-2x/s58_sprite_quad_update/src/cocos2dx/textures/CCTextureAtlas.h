#pragma once

#include "../sprite_nodes/CCSprite.h"
#include <vector>

class CCTextureAtlas {
public:
    void updateQuad(const ccV3F_C4B_T2F_Quad& quad, unsigned int index);
    bool dirty() const { return m_bDirty; }
    const ccV3F_C4B_T2F_Quad& quadAt(unsigned int index) const { return m_pQuads.at(index); }

private:
    std::vector<ccV3F_C4B_T2F_Quad> m_pQuads;
    bool m_bDirty = false;
};
