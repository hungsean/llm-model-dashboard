import type { ModelPricing } from "../worker/types";
import type { FilterState, Condition, StringCondition, NumberCondition } from "./filterTypes";
import { isStringField } from "./filterTypes";

function isStringCondition(c: Condition): c is StringCondition {
  return isStringField(c.field);
}

function isNumberCondition(c: Condition): c is NumberCondition {
  return !isStringField(c.field);
}

function matchesCondition(model: ModelPricing, cond: Condition): boolean {
  if (isStringCondition(cond)) {
    if (cond.value === "") return true; // incomplete — skip
    const modelVal = (model[cond.field] as string | null) ?? "";
    const q = cond.value.toLowerCase();
    if (cond.op === "equals") return modelVal.toLowerCase() === q;
    if (cond.op === "contains") return modelVal.toLowerCase().includes(q);
    return true;
  }

  if (isNumberCondition(cond)) {
    if (cond.value === "") return true; // incomplete — skip
    const modelVal = model[cond.field] as number | null;
    if (modelVal === null) return false; // null never satisfies numeric conditions
    const v = parseFloat(cond.value);
    if (isNaN(v)) return true; // malformed — skip
    if (cond.op === "<") return modelVal < v;
    if (cond.op === "<=") return modelVal <= v;
    if (cond.op === ">") return modelVal > v;
    if (cond.op === ">=") return modelVal >= v;
    if (cond.op === "between") {
      if (cond.value2 === "") return true; // second bound missing — skip
      const v2 = parseFloat(cond.value2);
      if (isNaN(v2)) return true;
      return modelVal >= v && modelVal <= v2;
    }
    return true;
  }

  return true;
}

function matchesGroup(model: ModelPricing, group: { conditions: Condition[] }): boolean {
  return group.conditions.every((c) => matchesCondition(model, c));
}

// Returns true if the model satisfies the OR-of-AND filter (empty filter = pass all).
export function matchesFilter(model: ModelPricing, filter: FilterState): boolean {
  if (filter.length === 0) return true;
  // skip groups with zero conditions
  const activeGroups = filter.filter((g) => g.conditions.length > 0);
  if (activeGroups.length === 0) return true;
  return activeGroups.some((g) => matchesGroup(model, g));
}
