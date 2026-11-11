import React, { useEffect, useState } from "react";
import { editGoal, goalStatusLabel, localDate, type LocalGoal } from "@productivity/domain";
import Sheet from "../../../components/Sheet";
import { Button, Chips, DateTimeButton, Field, Input } from "../../../components/Field";
import { dateOf } from "../../calendar/components/items";
import type { Goal } from "./useGoals";

type Review = "none" | "weekly" | "monthly";
type Status = LocalGoal["status"];

const statusOptions = (Object.keys(goalStatusLabel) as Status[]).map((s) => ({ value: s, label: goalStatusLabel[s] }));

/** Create or edit a goal: the outcome, why it matters, by when, and how often to review it. */
export default function GoalEditor({ goal, isNew = false, onClose, onSave }: { goal: Goal | null; isNew?: boolean; onClose: () => void; onSave: (g: Goal) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<Date | null>(null);
  const [review, setReview] = useState<Review>("none");
  const [status, setStatus] = useState<Status>("active");

  const id = goal?.id;
  useEffect(() => {
    if (!goal) return;
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setTarget(goal.targetDate ? dateOf(goal.targetDate) : null);
    setReview(goal.reviewCadence ?? "none");
    setStatus(goal.status);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!goal || !title.trim()) return;
    onSave(
      editGoal(
        goal,
        { title, description: description || null, targetDate: target ? localDate(target) : null, reviewCadence: review === "none" ? null : review, status },
        new Date(),
      ),
    );
  };

  return (
    <Sheet open={!!goal} title={isNew ? "New goal" : "Goal"} onClose={onClose}>
      <Field label="Goal">
        <Input accessibilityLabel="Goal" value={title} onChangeText={setTitle} maxLength={200} placeholder="e.g. Run a half marathon" autoFocus={isNew} />
      </Field>
      <Field label="Why it matters">
        <Input
          accessibilityLabel="Why it matters"
          value={description}
          onChangeText={setDescription}
          placeholder="You'll see this each time you review it"
          multiline
          textAlignVertical="top"
          style={{ minHeight: 64 }}
        />
      </Field>
      <Field label="By">
        <DateTimeButton label="Target date" mode="date" value={target} placeholder="No date" onChange={setTarget} onClear={() => setTarget(null)} />
      </Field>
      <Field label="Review">
        <Chips<Review>
          value={review}
          onChange={setReview}
          options={[
            { value: "none", label: "No reviews" },
            { value: "weekly", label: "Every week" },
            { value: "monthly", label: "Every month" },
          ]}
        />
      </Field>
      {isNew ? null : (
        <Field label="Status">
          <Chips value={status} options={statusOptions} onChange={setStatus} />
        </Field>
      )}
      <Button kind="primary" label={isNew ? "Add goal" : "Save"} onPress={save} disabled={!title.trim()} />
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}
