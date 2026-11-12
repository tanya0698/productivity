import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { byProject, localDate, projectCardStats } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { ProgressRing, TrendPill } from "../../../components/EntityCard";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { go } from "../../../navigation/ref";
import { useProjects } from "../../../shared/projects";
import { usePalette } from "../../../theme";
import type { Task } from "../../tasks/components/TaskRow";

/** Today's view of active projects: a ring for how far along, this week's done tasks and their trend. */
export default function SummaryWidget() {
  const p = usePalette();
  const { projects } = useProjects();
  const { records: tasks } = useLocalRecords<Task>("task");
  const active = projects.filter((x) => x.status === "active").slice(0, 3);
  const grouped = byProject(tasks, projects);
  const today = localDate(new Date());
  return (
    <>
      {active.length ? (
        active.map((x, n) => {
          const stats = projectCardStats(grouped.get(x.id) ?? [], today);
          return (
            <Pressable
              key={x.id}
              accessibilityRole="link"
              onPress={() => go("projects", { project: x.id })}
              style={({ pressed }) => [styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : 1 }]}
            >
              <ProgressRing percent={stats.progress.percent} size={40} label={`${x.title} complete`} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium" numberOfLines={1}>
                  {x.title}
                </Text>
                <Text tone="secondary" style={{ fontSize: 12 }} numberOfLines={1}>
                  {stats.progress.total ? `${stats.progress.done} of ${stats.progress.total} tasks · ${stats.doneThisWeek.now} this week` : "No tasks yet"}
                </Text>
              </View>
              <TrendPill trend={{ ...stats.doneThisWeek }} />
            </Pressable>
          );
        })
      ) : (
        <Text tone="secondary" style={{ paddingBottom: 8 }}>
          No active projects. Group a bigger piece of work under one.
        </Text>
      )}
      <FootLink label="All projects" onPress={() => go("projects")} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
});
