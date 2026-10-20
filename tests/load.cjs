const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Compile the actual TypeScript modules in memory, injecting external services.
// No real Stripe, Supabase or Resend calls and no dotenv files are loaded.
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`, mocks);
    if (id.startsWith(".")) return load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), id + ".ts")), mocks);
    return nativeRequire(id);
  };
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  mod._compile(js, filename);
  return mod.exports;
}
module.exports = { load };
