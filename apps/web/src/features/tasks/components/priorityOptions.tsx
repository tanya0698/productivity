import { priorityLabel } from "@productivity/domain";
import { PriorityLabel } from "./TaskRow";

/** Priority choices for selects: icon and name, most urgent first. */
export const priorityOptions = ([1, 2, 3, 4] as const).map((p) => ({
  value: p,
  label: <PriorityLabel priority={p} always />,
  title: priorityLabel[p],
}));
