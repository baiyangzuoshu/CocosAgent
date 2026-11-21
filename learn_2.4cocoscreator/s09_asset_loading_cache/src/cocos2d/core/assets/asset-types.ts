export interface AssetTypeInfo {
  name: string;
  group: string;
  role: string;
  parent?: string;
}

/** Source-backed inventory; these entries are an index, not implementations. */
export const assetTypes: AssetTypeInfo[] = [
  { name: "JsonAsset", group: "数据", role: "已解析的 JSON 对象" },
  { name: "TextAsset", group: "数据", role: "文本文件内容" },
  { name: "BufferAsset", group: "数据", role: "二进制缓冲数据" },
  { name: "Prefab", group: "场景与节点", role: "可实例化的节点模板" },
  { name: "SceneAsset", group: "场景与节点", role: "可加载的场景资源" },
  { name: "SpriteFrame", group: "2D 图形", role: "纹理及其矩形/UV 信息" },
  { name: "SpriteAtlas", group: "2D 图形", role: "SpriteFrame 集合" },
  { name: "Texture2D", group: "2D 图形", role: "图片或像素数据对应的纹理" },
  { name: "Font", group: "2D 图形", role: "字体资源" },
  { name: "AnimationClip", group: "动画与地图", role: "动画片段数据" },
  { name: "ParticleAsset", group: "动画与地图", role: "粒子系统配置资源" },
  { name: "TiledMapAsset", group: "动画与地图", role: "Tiled 地图数据" },
  { name: "AudioClip", group: "媒体", role: "音频资源" },
  { name: "VideoClip", group: "媒体", role: "视频资源" },
  { name: "Material", group: "渲染与 3D", role: "材质配置" },
  { name: "EffectAsset", group: "渲染与 3D", role: "Effect/Shader 配置" },
  { name: "Model", group: "渲染与 3D", role: "3D 模型资源" },
  { name: "Mesh", group: "渲染与 3D", role: "网格几何数据" },
  { name: "Skeleton", group: "渲染与 3D", role: "3D 骨骼资源" },
  { name: "Script", group: "脚本与扩展", role: "脚本资源基类" },
  { name: "SkeletonData", group: "脚本与扩展", role: "Spine 骨骼数据" },
  { name: "DragonBonesAsset", group: "脚本与扩展", role: "DragonBones 骨骼数据" },
  { name: "DragonBonesAtlasAsset", group: "脚本与扩展", role: "DragonBones 图集数据" },
  { name: "JavaScript", group: "脚本与扩展", role: "JavaScript 脚本资源", parent: "Script" },
  { name: "TypeScript", group: "脚本与扩展", role: "TypeScript 脚本资源", parent: "Script" },
];
import { JsonAsset } from "./CCJsonAsset.ts";
import { Prefab } from "./CCPrefab.ts";
import { Texture2D } from "./CCTexture2D.ts";
import {
  AnimationClip,
  AudioClip,
  BufferAsset,
  DragonBonesAsset,
  DragonBonesAtlasAsset,
  EffectAsset,
  Font,
  JavaScript,
  Material,
  Mesh,
  Model,
  ParticleAsset,
  SceneAsset,
  Script,
  Skeleton,
  SkeletonData,
  SpriteAtlas,
  SpriteFrame,
  TextAsset,
  TiledMapAsset,
  TypeScript,
  VideoClip,
} from "./asset-subclasses.ts";


/** Constructors implemented by this lesson's trimmed class models. */
export const implementedAssetClasses = [
  JsonAsset,
  TextAsset,
  BufferAsset,
  Prefab,
  SceneAsset,
  SpriteFrame,
  SpriteAtlas,
  Texture2D,
  Font,
  AnimationClip,
  ParticleAsset,
  TiledMapAsset,
  AudioClip,
  VideoClip,
  Material,
  EffectAsset,
  Model,
  Mesh,
  Skeleton,
  Script,
  SkeletonData,
  DragonBonesAsset,
  DragonBonesAtlasAsset,
  JavaScript,
  TypeScript,
] as const;
