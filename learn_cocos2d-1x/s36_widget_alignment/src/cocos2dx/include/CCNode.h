#ifndef COURSE_1X_CCNODE_H
#define COURSE_1X_CCNODE_H

namespace cocos2d {

struct CCSize { float width; float height; };
struct CCPoint { float x; float y; };

class CCNode {
public:
  CCSize getContentSize() const;
  CCPoint getAnchorPoint() const;
  CCPoint getPosition() const;
  void setContentSize(CCSize size);
  void setAnchorPoint(CCPoint anchor);
  void setPosition(CCPoint position);

private:
  CCSize _contentSize{0, 0};
  CCPoint _anchorPoint{0.5f, 0.5f};
  CCPoint _position{0, 0};
};

} // namespace cocos2d

#endif
