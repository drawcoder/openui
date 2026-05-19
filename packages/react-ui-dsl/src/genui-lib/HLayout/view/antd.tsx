"use client";

import { Flex } from "antd";
import type { HLayoutViewProps } from "./types";

export function HLayoutView({ children, gap, style, wrap }: HLayoutViewProps) {
  return (
    <Flex gap={gap} style={style} wrap={wrap ? "wrap" : "nowrap"}>
      {children}
    </Flex>
  );
}
