import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { byProject, projectProgress } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { useProjects } from "../../../shared/projects";
import { usePalette } from "../../../theme";
import type { Task } from "../../tasks/components/TaskRow";
import ProjectProgress from "../components/ProjectProgress";
import { go } from "../../../navigation/ref";

/** Today's view of active projects and how far along each is. */
export default function SummaryWidget() {  const p = usePalette();
  const { projects } = useProjects();
  const { records: tasks } = useLocalRecords<Task>("task");
  const active = projects.filter((x) => x.status === "active").slice(0, 4);
  const grouped = byProject(tasks, projects);
  return (
    <>
      {active.length ? (
        active.map((x, n) => (
          <Pressable
            key={x.id}
            accessibilityRole="link"
            onPress={() => go("projects", { project: x.id })}
            style={[styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}
          >
            <Text weight="medium" numberOfLines={1}>
              {x.title}
            </Text>
            <ProjectProgress progress={projectProgress(grouped.get(x.id) ?? [])} />
          </Pressable>
        ))
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
  row: { paddingVertical: 10, gap: 6 },
});
