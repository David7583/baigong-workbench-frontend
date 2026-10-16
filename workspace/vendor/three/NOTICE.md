# Three.js 0.186.1

Upstream: https://github.com/mrdoob/three.js ; package https://registry.npmjs.org/three/-/three-0.186.1.tgz . MIT license and copyright: see LICENSE.

This distribution includes 19 .mjs files: three.core, three.module, OrbitControls and addons for environments, geometries, loaders, math, postprocessing, shaders and utilities. The complete upstream mapping and hashes are in ../../../../docs/audit/three-files.json (repository root: docs/audit/three-files.json).

Modifications: .js filenames/import suffixes become .mjs; bare `three` imports use local static-service paths (`./three.module.mjs` or `/vendor/three.module.mjs`); one documentation import suffix and trailing blank lines follow the same adaptation. No component logic changes were found in comparison with the fixed upstream package. Original copyright/source comments are retained, including source references in RoomEnvironment, SimplexNoise and SSAOShader.

No CDN is needed. These upstream files are third-party source and do not acquire the project's business-script header or Apache license.
