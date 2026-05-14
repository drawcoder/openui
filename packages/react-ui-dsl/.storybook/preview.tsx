import type { Preview } from "@storybook/react";

if (process.env.REACT_UI_DSL_VIEW_TARGET !== "eview") {
  void import("antd/dist/reset.css");
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    backgrounds: {
      default: "canvas",
      values: [
        {
          name: "canvas",
          value: "#f5f7fb",
        },
      ],
    },
  },
};

export default preview;
