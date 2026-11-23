"use client";

import { useOptimistic, useTransition } from "react";
import { toggleCampaignTask } from "../actions";

/** The owner's checklist for a campaign plan (TASKS field). Checking a task is saved and logged. */
export function TaskList({ campaignId, tasks, done }: { campaignId: string; tasks: string[]; done: string[] }) {
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(new Set(done), (state: Set<string>, change: { task: string; on: boolean }) => {
    const next = new Set(state);
    if (change.on) next.add(change.task);
    else next.delete(change.task);
    return next;
  });
  const count = tasks.filter((t) => checked.has(t)).length;

  return (
    <div>
      <div className="mb-2 text-xs text-soft">
        {count} de {tasks.length} feitas
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => {
          const on = checked.has(t);
          return (
            <li key={t}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${on ? "border-[#2f5f58] bg-[#203c3a]" : "border-line bg-[#0f1a28]"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    const value = e.target.checked;
                    startTransition(async () => {
                      setChecked({ task: t, on: value });
                      await toggleCampaignTask(campaignId, t, value);
                    });
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#5cd8bc]"
                />
                <span className={on ? "text-soft line-through" : ""}>{t}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
