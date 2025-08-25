import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync } from "fs";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(() => {
  return {
    build: {
      lib: {
        entry: resolve(__dirname, "packages/code/src/python/client.ts"),
        name: "MyPythonClient",
        fileName: "client",
        formats: ["cjs", "es"],
      },
      rollupOptions: {
        external: [],
        output: {
          entryFileNames: `[name].js`,
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`,

          manualChunks(id) {
            if (id.includes("workbench")) return "workbench";
          },
        },
      },
      emptyOutDir: false,
    },

    resolve: {
      alias: {
        path: "path-browserify",
      },
    },

    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          {
            name: "import.meta.url",
            setup({ onLoad }: any) {
              onLoad(
                {
                  filter: /default-extensions\/.*\.js/,
                  namespace: "file",
                },
                (args: any) => {
                  let code = readFileSync(args.path, "utf8");
                  code = code.replace(
                    /\bimport\.meta\.url\b/g,
                    `new URL('/@fs/${args.path}', window.location.origin)`
                  );
                  return { contents: code };
                }
              );
            },
          },
        ],
      },
    },

    plugins: [
      viteStaticCopy({
        targets: [
          { src: "packages/code/package.json", dest: "" },
          { src: "packages/code/README.md", dest: "" },
        ],
      }),
    ],
  };
});
