const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so workspace packages (@counter/tokens,
// @counter/sync) hot-reload when edited.
config.watchFolders = [workspaceRoot];

// pnpm hoists differently; tell Metro to look in the project's
// node_modules first, then fall back to the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

// Enable subpath exports so `@counter/tokens/native` resolves via the
// `exports` map in packages/tokens/package.json. Without this, Metro
// only honours `main`/`module` and fails to resolve subpath imports.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'import', 'default'];

// Workarounds for Metro bundling issues:
//   1. zustand's ESM build uses `import.meta.env` (Vite-style dev/prod
//      detection) which Hermes does not support and Metro does not
//      transform. Force the CJS build by disabling package exports
//      just for that module.
//   2. WatermelonDB's SQLiteAdapter statically references a Node-only
//      sibling (`adapters/sqlite/sqlite-node/Database.js`) that pulls
//      in `better-sqlite3`. The native bundle never reaches that path
//      at runtime, but Metro still tries to resolve it. Alias to a
//      tiny stub so the bundle finishes.
const SQLITE_NODE_STUB = path.resolve(__dirname, 'metro-stubs/empty.js');
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }
  if (moduleName === 'better-sqlite3') {
    return { type: 'sourceFile', filePath: SQLITE_NODE_STUB };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
