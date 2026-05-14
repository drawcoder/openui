"use client";

import { Flex } from "antd";
import type { VLayoutViewProps } from "./types";

export function VLayoutView({ children, gap, style }: VLayoutViewProps) {
  return (
    <Flex gap={gap} style={style} vertical>
      {children}
    </Flex>
  );
}
