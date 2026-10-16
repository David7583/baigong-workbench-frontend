# 本地 Three.js 展示依赖

上游：three 0.186.1，https://registry.npmjs.org/three/-/three-0.186.1.tgz ，https://github.com/mrdoob/three.js 。MIT 许可全文见本目录 LICENSE。

来源是本项目已准备的固定 npm 包，不重新下载。复制 build/three.module.js、build/three.core.js、examples/jsm/controls/OrbitControls.js；为适配既有静态服务只允许 .mjs 的规则，重命名为 .mjs，并将 three.core.js 的相对导入后缀改为 .mjs，将 OrbitControls 的 bare 'three' 导入改为 './three.module.mjs'。无其他实现修改。

不使用 CDN、额外构建器、React 或 WebGPU。上游源哈希、发布完整性及副本哈希在本轮固定文件清单中保存。正式展示不依赖 development/staging 环境路径。编译后的第三方发布文件不是本项目业务脚本，不添加本项目脚本 Header。
