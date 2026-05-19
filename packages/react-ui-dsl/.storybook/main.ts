import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";
import { mergeConfig } from "vite";
import { createViewTargetAliases } from "../view-target.config.ts";

const reactUiDslEnv = {
  REACT_UI_DSL_VIEW_TARGET: process.env.REACT_UI_DSL_VIEW_TARGET,
};

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions", "@storybook/blocks"],
  framework: "@storybook/react-vite",
  previewHead: (head) => `
    ${head}
    <script>globalThis.__REACT_UI_DSL_ENV__ = ${JSON.stringify(reactUiDslEnv)};</script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.css">
  `,
  viteFinal: async (config) =>
    mergeConfig(config, {
      server: {
        allowedHosts: [".trycloudflare.com", "127.0.0.1", "localhost"],
      },
      resolve: {
        alias: {
          ...createViewTargetAliases(path.resolve(__dirname, "..")),
          "@openuidev/react-lang": path.resolve(__dirname, "../../react-lang/src/index.ts"),
          "@openuidev/lang-core": path.resolve(__dirname, "../../lang-core/src/index.ts"),
        },
      },
      optimizeDeps: {
        exclude: ["@openuidev/react-lang", "@openuidev/lang-core"],
        include:
          process.env.REACT_UI_DSL_VIEW_TARGET === "eview"
            ? ["react", "react-dom", "echarts", "react-markdown"]
            : ["react", "react-dom", "antd", "echarts", "react-markdown"],
      },
      build: {
        commonjsOptions: {
          include: [/@openuidev\/react-lang/, /@openuidev\/lang-core/, /node_modules/],
        },
      },
    }),
};

export default config;
