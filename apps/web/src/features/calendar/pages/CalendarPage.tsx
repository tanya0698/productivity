import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App as AntApp, Button, Card, Flex, Grid, Segmented, Typography } from "antd";
import { LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { editEvent, movedWhen, overrideOccurrence, rescheduleReminder } from "@productivity/domain";
import { ModulePage, deviceTimezone, useNow, useProjects, useReminders, useSyncRuntime } from "@/shared";
import { AgendaView } from "../components/AgendaView";
import { EventEditor, type EditorTarget } from "../components/EventEditor";
import { MonthView } from "../components/MonthView";
import { TimeGrid } from "../components/TimeGrid";
import { daysFrom, useCalendarItems, weekStart, ymd, type CalendarItem } from "../components/items";

type View = "month" | "week" | "day" | "agenda";
const VIEWS: View[] = ["month", "week", "day", "agenda"];
const VIEW_KEY = "productivity:calendar-view";

const savedView = (): View | null => {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    return v && VIEWS.includes(v) ? v : null;
  } catch {
    return null;
  }
};

/** The range a view shows, as YYYY-MM-DD dates (`to` exclusive), and its title. */
function rangeOf(view: View, date: Dayjs): { from: Dayjs; days: number; title: string } {
  switch (view) {
    case "month": {
      const from = weekStart(date.startOf("month"));
      return { from, days: Math.ceil(date.endOf("month").diff(from, "day") / 7) * 7, title: date.format("MMMM YYYY") };
    }
    case "week": {
      const from = weekStart(date);
      const to = from.add(6, "day");
      const title = from.month() === to.month() ? `${from.format("D")}–${to.format("D MMM YYYY")}` : `${from.format("D MMM")} – ${to.format("D MMM YYYY")}`;
      return { from, days: 7, title };
    }
    case "day":
      return { from: date.startOf("day"), days: 1, title: date.format("dddd D MMMM YYYY") };
    case "agenda":
      return { from: date.startOf("day"), days: 14, title: `${date.format("D MMM")} – ${date.add(13, "day").format("D MMM YYYY")}` };
  }
}

const step: Record<View, [number, "month" | "week" | "day"]> = {
  month: [1, "month"],
  week: [1, "week"],
  day: [1, "day"],
  agenda: [14, "day"],
};

/**
 * The calendar: month, week, day and agenda views of events and dated tasks.
 * The view and date live in the URL (?view=week&date=2026-11-09), so the back
 * button and links work; ?event=<id> opens that event (from a reminder).
 */
export default function CalendarPage() {
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const [params, setParams] = useSearchParams();
  const { projects } = useProjects();
  const { records: reminders } = useReminders();
  const now = useNow(60_000);
  const today = ymd(now);

  const view: View = (VIEWS.includes(params.get("view") as View) ? params.get("view") : null) as View | null ?? savedView() ?? (screens.md === false ? "agenda" : "week");
  const date = params.get("date") ? dayjs(params.get("date")) : dayjs(today);
  const { from, days, title } = rangeOf(view, date);
  const dayList = daysFrom(from, days);
  const { items, events } = useCalendarItems(dayList[0]!, ymd(from.add(days, "day")));
  const [target, setTarget] = useState<EditorTarget | null>(null);

  const go = (next: { view?: View; date?: Dayjs }) => {
    const v = next.view ?? view;
    if (next.view) {
      try {
        localStorage.setItem(VIEW_KEY, next.view);
      } catch {
        /* remembered for this visit only */
      }
    }
    setParams({ view: v, date: ymd(next.date ?? date) });
  };

  // ?event=<id> (from a reminder): open its next occurrence once it's loaded.
  const linked = params.get("event");
  const [openedLink, setOpenedLink] = useState<string | null>(null);
  if (linked && linked !== openedLink) {
    const occ = items.find((i) => i.occurrence?.event.id === linked)?.occurrence;
    const ev = events.find((e) => e.id === linked);
    if (occ) {
      setOpenedLink(linked);
      setTarget({ kind: "edit", occurrence: occ });
    } else if (ev) {
      // Not in this range: jump to the event's day.
      setOpenedLink(null);
      setParams({ view, date: ev.startDate ?? dayjs(ev.startsAt).format("YYYY-MM-DD"), event: linked }, { replace: true });
    }
  }

  const open = (item: CalendarItem) => {
    if (item.kind === "task") navigate(`/tasks?task=${item.task!.id}`);
    else setTarget({ kind: "edit", occurrence: item.occurrence! });
  };
  const createAt = (start: Date) =>
    setTarget({ kind: "new", when: { allDay: false, start, end: dayjs(start).add(1, "hour").toDate(), timezone: deviceTimezone() } });
  const createAllDay = (day: string) =>
    setTarget({ kind: "new", when: { allDay: true, startDate: day, endDate: ymd(dayjs(day).add(1, "day")) } });

  /** Dragging: a one-off event moves (and its reminder with it); a repeating one moves just this occurrence. */
  const move = (item: CalendarItem, start: Date) => {
    const occ = item.occurrence;
    if (!occ) return;
    const tz = occ.event.timezone ?? deviceTimezone();
    const when = movedWhen(occ, start, tz);
    const t = new Date();
    if (occ.recurring) {
      void runtime.write("event_exception", overrideOccurrence(runtime.newId(), occ, { when }, t));
      void message.success("Moved this occurrence");
      return;
    }
    void runtime.write("event", editEvent(occ.event, {}, when, t));
    const shift = start.getTime() - occ.start.getTime();
    for (const r of reminders.filter((r) => r.eventId === occ.event.id && r.status !== "dismissed" && r.status !== "done")) {
      void runtime.write("reminder", rescheduleReminder(r, { remindAt: new Date(new Date(r.remindAt).getTime() + shift) }, t));
    }
    void message.success(`Moved to ${dayjs(start).format("ddd D MMM, HH:mm")}`);
  };

  return (
    <ModulePage
      eyebrow="Plan"
      title="Calendar"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => createAt(dayjs(date).hour(9).minute(0).second(0).toDate())}>
          New event
        </Button>
      }
    >
      <Flex align="center" gap={8} wrap className="pp-cal-toolbar">
        <Button onClick={() => go({ date: dayjs(today) })}>Today</Button>
        <Button icon={<LeftOutlined />} aria-label="Previous" onClick={() => go({ date: date.subtract(...step[view]) })} />
        <Button icon={<RightOutlined />} aria-label="Next" onClick={() => go({ date: date.add(...step[view]) })} />
        <Typography.Title level={4} style={{ margin: "0 8px 0 4px", fontSize: 18 }}>
          {title}
        </Typography.Title>
        <Segmented<View>
          style={{ marginLeft: "auto" }}
          value={view}
          onChange={(v) => go({ view: v })}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
            { value: "agenda", label: "Agenda" },
          ]}
        />
      </Flex>

      <Card className="pp-card pp-cal-card" styles={{ body: { padding: view === "agenda" ? 16 : 0 } }}>
        {view === "month" ? (
          <MonthView
            month={date}
            items={items}
            today={today}
            onDay={(d) => go({ view: "day", date: dayjs(d) })}
            onOpen={open}
            onCreateDay={(d) => createAt(dayjs(d).hour(9).toDate())}
          />
        ) : view === "agenda" ? (
          <AgendaView days={dayList} items={items} today={today} onOpen={open} />
        ) : (
          <TimeGrid
            days={dayList}
            items={items}
            today={today}
            now={now}
            onCreate={createAt}
            onCreateAllDay={createAllDay}
            onOpen={open}
            onMove={move}
            onDay={view === "week" ? (d) => go({ view: "day", date: dayjs(d) }) : undefined}
          />
        )}
      </Card>

      <EventEditor
        target={target}
        projects={projects}
        onClose={() => {
          setTarget(null);
          if (linked) {
            const next = new URLSearchParams(params);
            next.delete("event");
            setParams(next, { replace: true });
            setOpenedLink(null);
          }
        }}
      />
    </ModulePage>
  );
}
