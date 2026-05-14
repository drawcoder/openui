import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));

const VIEW_COMPONENTS = [
  "Button",
  "Form",
  "HLayout",
  "Link",
  "Select",
  "Table",
  "Tabs",
  "Tag",
  "TimeLine",
  "VLayout",
] as const;

export type ReactUiDslViewTarget = "antd" | "eview";

export function getReactUiDslViewTarget(
  env: NodeJS.ProcessEnv = process.env,
): ReactUiDslViewTarget {
  return env.REACT_UI_DSL_VIEW_TARGET === "eview" ? "eview" : "antd";
}

export function createViewTargetAliases(
  rootDir = CONFIG_DIR,
  target = getReactUiDslViewTarget(),
): Record<string, string> {
  if (target === "antd") return {};

  return Object.fromEntries(
    VIEW_COMPONENTS.flatMap((component) => {
      const viewDir = path.resolve(rootDir, "src", "genui-lib", component, "view");
      const replacement = path.join(viewDir, "eview.tsx");
      return [
        [path.join(viewDir, "index.tsx"), replacement],
        [path.join(viewDir, "index"), replacement],
      ];
    }),
  );
}

export function shouldLoadAntdStyles(env: NodeJS.ProcessEnv = process.env): boolean {
  return getReactUiDslViewTarget(env) === "antd";
}
