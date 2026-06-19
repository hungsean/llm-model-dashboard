import { useState } from "react";
import type {
  FilterState,
  FilterGroup,
  Condition,
  StringField,
  NumberField,
  FilterField,
  StringOp,
  NumberOp,
} from "./filterTypes";
import {
  STRING_FIELDS,
  NUMBER_FIELDS,
  STRING_OPS,
  NUMBER_OPS,
  FIELD_LABELS,
  OP_LABELS,
  isStringField,
} from "./filterTypes";
import "./FilterBuilder.css";

let _seq = 0;
function uid(): string {
  return String(++_seq);
}

function defaultCondition(field: FilterField = "provider"): Condition {
  if (isStringField(field)) {
    return { id: uid(), field: field as StringField, op: "equals", value: "" };
  }
  return { id: uid(), field: field as NumberField, op: "<", value: "", value2: "" };
}

function defaultGroup(): FilterGroup {
  return { id: uid(), conditions: [defaultCondition()] };
}

interface Props {
  filter: FilterState;
  onChange: (next: FilterState) => void;
}

export default function FilterBuilder({ filter, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = filter.reduce((s, g) => s + g.conditions.length, 0);

  function addGroup() {
    onChange([...filter, defaultGroup()]);
    setOpen(true);
  }

  function removeGroup(gid: string) {
    onChange(filter.filter((g) => g.id !== gid));
  }

  function addCondition(gid: string) {
    onChange(
      filter.map((g) =>
        g.id === gid ? { ...g, conditions: [...g.conditions, defaultCondition()] } : g,
      ),
    );
  }

  function removeCondition(gid: string, cid: string) {
    onChange(
      filter.map((g) =>
        g.id === gid ? { ...g, conditions: g.conditions.filter((c) => c.id !== cid) } : g,
      ),
    );
  }

  function updateCondition(gid: string, cid: string, patch: Partial<Condition>) {
    onChange(
      filter.map((g) =>
        g.id === gid
          ? {
              ...g,
              conditions: g.conditions.map((c) =>
                c.id === cid ? ({ ...c, ...patch } as Condition) : c,
              ),
            }
          : g,
      ),
    );
  }

  function changeField(gid: string, cid: string, field: FilterField) {
    // Reset op and value when field type changes
    if (isStringField(field)) {
      updateCondition(gid, cid, { field: field as StringField, op: "equals", value: "" } as Partial<Condition>);
    } else {
      updateCondition(gid, cid, { field: field as NumberField, op: "<", value: "", value2: "" } as Partial<Condition>);
    }
  }

  function clear() {
    onChange([]);
  }

  return (
    <div className="fb-wrapper">
      <div className="fb-header">
        <button
          type="button"
          className="fb-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="fb-toggle-icon">{open ? "▾" : "▸"}</span>
          條件建構器
          {activeCount > 0 && <span className="fb-badge">{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button type="button" className="fb-clear" onClick={clear}>
            清空
          </button>
        )}
        {!open && (
          <button type="button" className="fb-add-group-inline" onClick={addGroup}>
            + 新增群組
          </button>
        )}
      </div>

      {open && (
        <div className="fb-body">
          {filter.length === 0 && (
            <p className="fb-empty-hint">尚無條件，點「新增群組」開始建構。</p>
          )}

          {filter.map((group, gi) => (
            <div key={group.id} className="fb-group">
              {gi > 0 && <div className="fb-or-sep">OR</div>}
              <div className="fb-group-inner">
                <div className="fb-group-header">
                  <span className="fb-group-label">群組 {gi + 1}</span>
                  <button
                    type="button"
                    className="fb-btn-remove-group"
                    onClick={() => removeGroup(group.id)}
                    aria-label={`刪除群組 ${gi + 1}`}
                  >
                    刪除群組
                  </button>
                </div>

                {group.conditions.map((cond, ci) => (
                  <div key={cond.id} className="fb-cond-row">
                    {ci > 0 && <span className="fb-and-badge">AND</span>}

                    <select
                      value={cond.field}
                      onChange={(e) => changeField(group.id, cond.id, e.target.value as FilterField)}
                      aria-label="欄位"
                      className="fb-select"
                    >
                      <optgroup label="字串欄位">
                        {STRING_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="數值欄位">
                        {NUMBER_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    {isStringField(cond.field) ? (
                      <>
                        <select
                          value={(cond as { op: StringOp }).op}
                          onChange={(e) =>
                            updateCondition(group.id, cond.id, { op: e.target.value as StringOp })
                          }
                          aria-label="運算子"
                          className="fb-select fb-select-op"
                        >
                          {STRING_OPS.map((op) => (
                            <option key={op} value={op}>
                              {OP_LABELS[op]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="fb-input"
                          value={(cond as { value: string }).value}
                          onChange={(e) =>
                            updateCondition(group.id, cond.id, { value: e.target.value })
                          }
                          placeholder="值"
                          aria-label="條件值"
                        />
                      </>
                    ) : (
                      <>
                        <select
                          value={(cond as { op: NumberOp }).op}
                          onChange={(e) =>
                            updateCondition(group.id, cond.id, { op: e.target.value as NumberOp })
                          }
                          aria-label="運算子"
                          className="fb-select fb-select-op"
                        >
                          {NUMBER_OPS.map((op) => (
                            <option key={op} value={op}>
                              {OP_LABELS[op]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="fb-input fb-input-num"
                          value={(cond as { value: string }).value}
                          onChange={(e) =>
                            updateCondition(group.id, cond.id, { value: e.target.value })
                          }
                          placeholder={(cond as { op: NumberOp }).op === "between" ? "下限" : "值"}
                          aria-label="條件值"
                        />
                        {(cond as { op: NumberOp }).op === "between" && (
                          <>
                            <span className="fb-between-sep">–</span>
                            <input
                              type="number"
                              className="fb-input fb-input-num"
                              value={(cond as { value2: string }).value2}
                              onChange={(e) =>
                                updateCondition(group.id, cond.id, { value2: e.target.value })
                              }
                              placeholder="上限"
                              aria-label="條件上限值"
                            />
                          </>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      className="fb-btn-remove-cond"
                      onClick={() => removeCondition(group.id, cond.id)}
                      aria-label="刪除條件"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="fb-btn-add-cond"
                  onClick={() => addCondition(group.id)}
                >
                  + 新增條件
                </button>
              </div>
            </div>
          ))}

          <div className="fb-footer">
            <button type="button" className="fb-btn-add-group" onClick={addGroup}>
              + 新增群組 (OR)
            </button>
            {filter.length > 0 && (
              <button type="button" className="fb-clear" onClick={clear}>
                清空全部
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
