#ifndef COURSE_2X_CCNODE_H
#define COURSE_2X_CCNODE_H

namespace cocos2d {

struct CCSize { float width; float height; };
struct CCPoint { float x; float y; };

class CCNode {
public:
  void setContentSize(CCSize size) { _contentSize = size; }
  CCSize getContentSize() const { return _contentSize; }
  void setAnchorPoint(CCPoint anchor) { _anchorPoint = anchor; }
  CCPoint getAnchorPoint() const { return _anchorPoint; }
  void setPosition(CCPoint position) { _position = position; }
  CCPoint getPosition() const { return _position; }

private:
  CCSize _contentSize{0, 0};
  CCPoint _anchorPoint{0.5f, 0.5f};
  CCPoint _position{0, 0};
};

} // namespace cocos2d

#endif
