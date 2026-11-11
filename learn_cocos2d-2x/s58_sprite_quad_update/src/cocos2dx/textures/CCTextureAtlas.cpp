#include "CCTextureAtlas.h"

void CCTextureAtlas::updateQuad(const ccV3F_C4B_T2F_Quad& quad, unsigned int index) {
    if (m_pQuads.size() <= index) m_pQuads.resize(index + 1);
    m_pQuads[index] = quad;
    m_bDirty = true;
}
