export type StringField = "provider" | "modelId" | "displayName";
export type NumberField =
  | "inputPricePerMTok"
  | "outputPricePerMTok"
  | "cachedInputPricePerMTok"
  | "contextWindow";
export type FilterField = StringField | NumberField;

export type StringOp = "equals" | "contains";
export type NumberOp = "<" | "<=" | ">" | ">=" | "between";

export interface StringCondition {
  id: string;
  field: StringField;
  op: StringOp;
  value: string;
}

export interface NumberCondition {
  id: string;
  field: NumberField;
  op: NumberOp;
  value: string;
  value2: string;
}

export type Condition = StringCondition | NumberCondition;

export interface FilterGroup {
  id: string;
  conditions: Condition[];
}

// OR-of-AND (DNF, 一層括號)；可序列化，#15 直接存這個結構
export type FilterState = FilterGroup[];

export const STRING_FIELDS: StringField[] = ["provider", "modelId", "displayName"];
export const NUMBER_FIELDS: NumberField[] = [
  "inputPricePerMTok",
  "outputPricePerMTok",
  "cachedInputPricePerMTok",
  "contextWindow",
];
export const STRING_OPS: StringOp[] = ["equals", "contains"];
export const NUMBER_OPS: NumberOp[] = ["<", "<=", ">", ">=", "between"];

export const FIELD_LABELS: Record<FilterField, string> = {
  provider: "Provider",
  modelId: "Model ID",
  displayName: "顯示名稱",
  inputPricePerMTok: "Input 價格",
  outputPricePerMTok: "Output 價格",
  cachedInputPricePerMTok: "Cached Input 價格",
  contextWindow: "Context Window",
};

export const OP_LABELS: Record<StringOp | NumberOp, string> = {
  equals: "等於",
  contains: "包含",
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
  between: "介於",
};

export function isStringField(field: FilterField): field is StringField {
  return (STRING_FIELDS as string[]).includes(field);
}
