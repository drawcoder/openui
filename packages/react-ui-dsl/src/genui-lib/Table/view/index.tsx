"use client";

import type { ElementNode } from "@openuidev/react-lang";
import { Table as AntTable, Tooltip } from "antd";
import type { ColumnType } from "antd/es/table";
import type { CSSProperties, ReactNode } from "react";
import type { ColCellRenderer, ExpandRowRenderer } from "../schema";

export function formatCell(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export type TableRow = Record<string, unknown>;

export type ColViewProps = {
  field: string;
  options?: {
    cell?: ColCellRenderer | ElementNode;
    filterOptions?: string[];
    filterable?: boolean;
    sortable?: boolean;
    tooltip?: boolean;
  };
  title: string;
};

type ColumnValue =
  | ColViewProps
  | {
      props: ColViewProps;
      type: string;
      typeName?: string;
    };

function isColumnNode(column: ColumnValue): column is Extract<ColumnValue, { props: ColViewProps }> {
  return typeof column === "object" && column !== null && "props" in column;
}

function getColumnProps(column: ColumnValue): ColViewProps {
  return isColumnNode(column) ? column.props : column;
}

function isElementNode(value: unknown): value is ElementNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ElementNode).type === "element" &&
    typeof (value as ElementNode).typeName === "string" &&
    typeof (value as ElementNode).props === "object" &&
    (value as ElementNode).props !== null &&
    typeof (value as ElementNode).partial === "boolean"
  );
}

export function mapColumnsToAntd(
  columns: ColumnValue[],
  renderNode?: (value: unknown) => ReactNode,
): ColumnType<TableRow>[] {
  return columns.map((columnValue) => {
    const column = getColumnProps(columnValue);
    const options = column.options ?? {};

    const dataIndex = column.field.includes(".") ? column.field.split(".") : column.field;

    return {
      dataIndex,
      filters:
        options.filterable && options.filterOptions
          ? options.filterOptions.map((option) => ({ text: option, value: option }))
          : undefined,
      key: column.field,
      onFilter: options.filterable
        ? (value, record) => String(record[column.field]) === String(value)
        : undefined,
      ellipsis: options.tooltip ? true : undefined,
      render: (value: unknown, record: TableRow) => {
        if (typeof options.cell === "function") {
          return options.cell(value, record);
        }

        if (options.cell && isElementNode(options.cell)) {
          return renderNode ? renderNode(options.cell) : (options.cell as ReactNode);
        }

        const text = formatCell(value);
        if (options.tooltip) {
          return (
            <Tooltip title={text}>
              <span
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {text}
              </span>
            </Tooltip>
          );
        }

        return text;
      },
      sorter: options.sortable
        ? (a, b) => String(a[column.field] ?? "").localeCompare(String(b[column.field] ?? ""))
        : undefined,
      title: column.title,
    };
  });
}

export type TableViewProps = {
  columns: ColumnValue[];
  expandRow?: ExpandRowRenderer | ElementNode;
  renderNode?: (value: unknown) => ReactNode;
  rows: TableRow[];
  style?: CSSProperties;
};

export function TableView({ columns, expandRow, renderNode, rows, style }: TableViewProps) {
  return (
    <AntTable
      columns={mapColumnsToAntd(columns, renderNode)}
      dataSource={rows}
      expandable={
        expandRow
          ? {
              defaultExpandAllRows: rows.length <= 3,
              expandedRowRender: (record) => {
                if (isElementNode(expandRow)) {
                  return renderNode ? renderNode(expandRow) : null;
                }
                return (expandRow as ExpandRowRenderer)(record);
              },
            }
          : undefined
      }
      pagination={false}
      rowKey={(_, index) => String(index)}
      size="middle"
      style={style}
    />
  );
}
