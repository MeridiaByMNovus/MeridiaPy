import { defineConfig } from "vite";
import { resolve } from "path";



export default defineConfig(() => ({
  build: {
    lib: {
      entry: resolve(__dirname, "packages/code/src/python/server.ts"),
      name: "PythonServer",
      formats: ["cjs", "es"],
      fileName: (format) => `server.${format}.js`,
    },
    rollupOptions: {
      external: [
        "express",
        "fs",
        "path",
        "url",
        "querystring",
        "http",
        "crypto",
        "zlib",
        "stream",
        "util",
        "events",
        "buffer",
        "async_hooks",
      ],
    },
    target: "node16",
    ssr: true,
    emptyOutDir: false,
  },
}));
