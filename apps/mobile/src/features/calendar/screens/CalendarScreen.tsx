import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Button } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { deviceTimezone, useNow } from "../../../shared/reminders/active";
import { radii, usePalette } from "../../../theme";
import EventEditor, { type EditorTarget } from "../components/EventEditor";
import { dateOf, itemsOn, plusDays, timeRange, useCalendarItems, weekStart, ymd, type CalendarItem } from "../components/items";
import { go } from "../../../navigation/ref";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
type Nav = { navigate: (name: string, params?: object) => void; setParams: (p: object) => void };

/**
 * The calendar on the phone: a month with a dot under each busy day, and the
 * chosen day's events and dated tasks below. Tap an event to change it, a
 * task to open it, or add an event on the chosen day.
 */
export default function CalendarScreen() {
  const p = usePalette();
  const navigation = useNavigation<Nav>();
  const now = useNow(60_000);
  const today = ymd(now);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [target, setTarget] = useState<EditorTarget | null>(null);

  const gridStart = weekStart(month);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => plusDays(gridStart, i)), [gridStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = ymd(days[0]!);
  const to = ymd(plusDays(days[41]!, 1));
  const { items } = useCalendarItems(from, to);
  // A selected day outside the grid (after "Today" from another month) still lists.
  const { items: dayItemsAll } = useCalendarItems(selected, ymd(plusDays(dateOf(selected), 1)));
  const dayItems = itemsOn(dayItemsAll, selected);

  const busy = useMemo(() => {
    const m = new Map<string, { events: number; tasks: number }>();
    for (const d of days) {
      const on = itemsOn(items, ymd(d));
      if (on.length) m.set(ymd(d), { events: on.filter((i) => i.kind === "event").length, tasks: on.filter((i) => i.kind === "task").length });
    }
    return m;
  }, [items, days]);

  // Opened on one event from elsewhere (a reminder): navigate("calendar", { date }).
  const route = useRoute<{ key: string; name: string; params?: { date?: string } }>();
  const requested = route.params?.date;
  useEffect(() => {
    if (!requested) return;
    const d = dateOf(requested);
    setSelected(requested);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    navigation.setParams({ date: undefined });
  }, [requested, navigation]);

  const pick = (d: Date) => {
    setSelected(ymd(d));
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const goToday = () => pick(new Date());

  const create = () => {
    const base = dateOf(selected);
    let start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9);
    if (selected === today) {
      start = new Date(now);
      start.setHours(start.getHours() + 1, 0, 0, 0);
    }
    setTarget({ kind: "new", when: { allDay: false, start, end: new Date(start.getTime() + 3_600_000), timezone: deviceTimezone() } });
  };

  const open = (i: CalendarItem) => {
    if (i.kind === "task") go("tasks", { task: i.task!.id });
    else setTarget({ kind: "edit", occurrence: i.occurrence! });
  };

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedLabel =
    selected === today
      ? "Today"
      : dateOf(selected).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScreenFrame eyebrow="Plan" title="Calendar">
      <View style={[styles.month, { backgroundColor: p.surface, borderColor: p.border }]}>
        <View style={styles.monthHead}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </Pressable>
          <Text weight="bold" style={{ fontSize: 16 }}>
            {monthLabel}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={20} color={p.text} />
          </Pressable>
        </View>
        <View style={styles.week}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} label style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <View key={row} style={styles.week}>
            {days.slice(row * 7, row * 7 + 7).map((d) => {
              const key = ymd(d);
              const isSel = key === selected;
              const isToday = key === today;
              const inMonth = d.getMonth() === month.getMonth();
              const b = busy.get(key);
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${b ? `, ${b.events} events, ${b.tasks} tasks` : ""}`}
                  onPress={() => pick(d)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSel && { backgroundColor: p.primary },
                      !isSel && isToday && { borderWidth: 1.5, borderColor: p.primary },
                    ]}
                  >
                    <Text
                      weight={isSel || isToday ? "bold" : "regular"}
                      style={{ fontSize: 14, color: isSel ? p.onPrimary : inMonth ? p.text : p.textMuted }}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {b?.events ? <View style={[styles.dot, { backgroundColor: p.primary }]} /> : null}
                    {b?.tasks ? <View style={[styles.dot, { backgroundColor: p.warningText }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: p.primary }]} />
          <Text tone="muted" style={{ fontSize: 11 }}>
            Event
          </Text>
          <View style={[styles.dot, { backgroundColor: p.warningText, marginLeft: 10 }]} />
          <Text tone="muted" style={{ fontSize: 11 }}>
            Task due
          </Text>
          {selected !== today ? (
            <Pressable accessibilityRole="button" onPress={goToday} hitSlop={8} style={{ marginLeft: "auto" }}>
              <Text tone="brand" weight="semiBold" style={{ fontSize: 13 }}>
                Today
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Card title={selectedLabel} right={String(dayItems.length)}>
        {dayItems.length ? (
          dayItems.map((i, n) => {
            const past = !i.allDay && i.end.getTime() < now.getTime();
            return (
              <Pressable
                key={i.key}
                accessibilityRole="button"
                accessibilityLabel={`${i.title}, ${timeRange(i)}`}
                onPress={() => open(i)}
                style={({ pressed }) => [styles.item, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0, opacity: past ? 0.55 : pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 12, width: 92, color: p.textSecondary }}>{timeRange(i)}</Text>
                <View style={[styles.bar, { backgroundColor: i.kind === "task" ? p.warningText : p.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text weight="medium" numberOfLines={2}>
                    {i.title}
                  </Text>
                  {i.occurrence?.recurring ? (
                    <Text tone="muted" style={{ fontSize: 11 }}>
                      ↻ Repeats
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            Nothing on this day.
          </Text>
        )}
      </Card>
      <Button kind="primary" label={selected === today ? "New event today" : "New event on this day"} onPress={create} />

      <EventEditor target={target} onClose={() => setTarget(null)} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  month: { borderWidth: 1, borderRadius: radii.lg, padding: 10 },
  monthHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingBottom: 8 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 10, letterSpacing: 1, paddingBottom: 4 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 8, paddingHorizontal: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  bar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
});
