"use client";

import type { CSSProperties, ReactNode } from "react";

export type HLayoutViewProps = {
  children?: ReactNode;
  gap?: number;
  style?: CSSProperties;
  wrap?: boolean;
};
