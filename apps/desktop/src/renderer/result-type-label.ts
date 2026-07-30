export type ResultColumnType = "null" | "boolean" | "integer" | "real" | "datetime" | "text";

export function resultTypeLabel(type: ResultColumnType): string {
  return { null: "空值", boolean: "布尔", integer: "整数", real: "数值", datetime: "日期时间", text: "文本" }[type];
}
