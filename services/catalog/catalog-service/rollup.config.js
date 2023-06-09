// rollup.config.js
const typescript = require("@rollup/plugin-typescript");
const nodeResolve = require("@rollup/plugin-node-resolve");
const commonJs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");

const entryPoints = [
  "src/api/lambda.ts",
  "src/batch-create-products-handler.ts"
];
const configs = entryPoints.map((entryPoint) => ({
  input: entryPoint,
  output: {
    dir: "dist",
    format: "cjs",
    sourcemap: true,
  },
  plugins: [
    typescript(),
    commonJs(),
    nodeResolve({ exportConditions: ["node"] }),
    json(),
  ],
}));
module.exports = configs;
