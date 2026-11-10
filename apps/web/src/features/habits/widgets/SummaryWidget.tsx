import { Link } from "react-router-dom";
import { Flex } from "antd";
import { isScheduled, localDate } from "@productivity/domain";
import { useNow, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowsSkeleton } from "@/components/ui/Skeletons";
import { HabitRow } from "../components/HabitRow";
import { useHabits } from "../components/useHabits";

/** Today's habits, tickable from the Today page. */
export default function SummaryWidget() {
  const today = localDate(useNow(60_000));
  const { habits, index, tick, untick } = useHabits();
  const ready = useDataReady();
  const due = habits.filter((h) => isScheduled(h, today));
  if (!due.length) return ready || habits.length ? <EmptyState compact text={habits.length ? "No habits due today." : "No habits yet."} /> : <RowsSkeleton rows={3} check={false} />;
  return (
    <Flex vertical>
      {due.slice(0, 6).map((h) => (
        <HabitRow key={h.id} habit={h} index={index} today={today} onTick={(x) => void tick(x)} onUntick={(x) => void untick(x)} compact />
      ))}
      <Link to="/habits" style={{ marginTop: 8 }}>
        All habits
      </Link>
    </Flex>
  );
}
