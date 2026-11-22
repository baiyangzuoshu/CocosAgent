import { BundleOutputMap } from "./cocos2d/core/asset-manager/BundleOutputMap.ts";

// Names below were checked against 2.4NewProject/build/web-mobile. Content hashes are snapshot-specific.
export const currentWebBuild = new BundleOutputMap([
  { path: "index.html", role: "page", note: "canvas/DOM shell; this snapshot selects minified runtime files", loads: ["style-mobile.25fc5.css", "src/settings.ebd7d.js", "main.17729.js", "cocos2d-js-min.7038f.js", "physics-min.ad9a7.js"] },
  { path: "style-mobile.25fc5.css", role: "style", note: "mobile page and splash presentation" },
  { path: "cocos2d-js-min.7038f.js", role: "engine", note: "Creator 2.4.15 Web runtime bundle" },
  { path: "physics-min.ad9a7.js", role: "physics", note: "separate physics backend bundle, dynamically loaded when physics macros are enabled" },
  { path: "src/settings.ebd7d.js", role: "startup", note: "publishes _CCSettings: debug flags, launch scene and bundle versions" },
  { path: "main.17729.js", role: "startup", note: "bootstraps settings, engine and game startup" },
  { path: "assets/main/config.a9f01.json", role: "bundle-config", note: "main bundle UUID/path/pack/version indexes", loads: ["assets/main/index.a9f01.js", "assets/main/import/05/05dd1dc0e.29693.json", "assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png"] },
  { path: "assets/main/index.a9f01.js", role: "bundle-script", note: "main bundle registration script" },
  { path: "assets/main/import/05/05dd1dc0e.29693.json", role: "import", note: "serialized import pack (shortened UUID file name)" },
  { path: "assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png", role: "native", note: "native image file with version suffix" },
  { path: "assets/internal/config.9e51c.json", role: "bundle-config", note: "internal runtime asset indexes", loads: ["assets/internal/index.9e51c.js", "assets/internal/import/0b/0b6c4470e.9537f.json"] },
  { path: "assets/internal/index.9e51c.js", role: "bundle-script", note: "internal bundle registration script" },
  { path: "assets/internal/import/0b/0b6c4470e.9537f.json", role: "import", note: "internal serialized import asset" },
  { path: "assets/BundleMain/config.42389.json", role: "bundle-config", note: "custom bundle; declares dependency on internal bundle", loads: ["assets/BundleMain/index.42389.js", "assets/BundleMain/import/2b/2b1ac59a-eccf-4c5a-ae44-ee2313507b57.e273f.json", "assets/BundleMain/native/1a/1ac845df8.ba8ed.png"] },
  { path: "assets/BundleMain/index.42389.js", role: "bundle-script", note: "custom BundleMain registration script" },
  { path: "assets/BundleMain/import/2b/2b1ac59a-eccf-4c5a-ae44-ee2313507b57.e273f.json", role: "import", note: "label.prefab import payload" },
  { path: "assets/BundleMain/native/1a/1ac845df8.ba8ed.png", role: "native", note: "custom bundle texture" },
]);
