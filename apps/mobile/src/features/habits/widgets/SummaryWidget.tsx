import React from "react";
import { isScheduled, localDate } from "@productivity/domain";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { go } from "../../../navigation/ref";
import { useNow } from "../../../shared/reminders/active";
import HabitRow from "../components/HabitRow";
import { useHabits } from "../components/useHabits";

/** Today's habits, tickable from Today. */
export default function SummaryWidget() {
  const today = localDate(useNow(60_000));
  const { habits, index, tick, untick } = useHabits();
  const due = habits.filter((h) => isScheduled(h, today));
  return (
    <>
      {due.length ? (
        due
          .slice(0, 6)
          .map((h, n) => (
            <HabitRow key={h.id} habit={h} index={index} today={today} first={n === 0} compact onTick={(x) => void tick(x)} onUntick={(x) => void untick(x)} />
          ))
      ) : (
        <Text tone="secondary" style={{ paddingBottom: 8 }}>
          {habits.length ? "No habits due today." : "No habits yet."}
        </Text>
      )}
      <FootLink label="All habits" onPress={() => go("habits")} />
    </>
  );
}
