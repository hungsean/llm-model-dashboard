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

// A condition is "completed" when it has enough input to be meaningful.
// Incomplete conditions are skipped (pass-through) within a group,
// but a group with NO completed conditions is not a valid OR branch.
function isCompleted(c: Condition): boolean {
  if (isStringCondition(c)) return c.value !== "";
  if (isNumberCondition(c)) {
    if (c.value === "" || isNaN(parseFloat(c.value))) return false;
    if (c.op === "between") return c.value2 !== "" && !isNaN(parseFloat(c.value2));
    return true;
  }
  return false;
}

function matchesGroup(model: ModelPricing, group: { conditions: Condition[] }): boolean {
  return group.conditions.every((c) => matchesCondition(model, c));
}

// Returns true if the model satisfies the OR-of-AND filter (empty filter = pass all).
// A group is only treated as a live OR branch when it has at least one completed condition;
// otherwise adding a new empty group would silently pass all rows.
export function matchesFilter(model: ModelPricing, filter: FilterState): boolean {
  if (filter.length === 0) return true;
  const activeGroups = filter.filter((g) => g.conditions.some(isCompleted));
  if (activeGroups.length === 0) return true;
  return activeGroups.some((g) => matchesGroup(model, g));
}
