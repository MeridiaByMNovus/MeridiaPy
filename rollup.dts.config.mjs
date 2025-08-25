import { resolve } from "path";
import dts from "rollup-plugin-dts";

export default [
  {
    input: resolve("packages/code/src/python/client.ts"),
    output: {
      file: "dist/client.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
  {
    input: resolve("packages/code/src/python/server.ts"),
    output: {
      file: "dist/server.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
];