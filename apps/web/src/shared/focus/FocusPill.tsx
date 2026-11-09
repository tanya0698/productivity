import { useNavigate } from "react-router-dom";
import { HourglassOutlined, PauseOutlined } from "@ant-design/icons";
import { clock, remainingMs } from "@productivity/domain";
import { useFocus, useTicking } from "./useFocus";

/** In the header while a timer runs (or is paused): what it is and how long is left. Opens the Focus page. */
export function FocusPill() {
  const navigate = useNavigate();
  const { timer } = useFocus();
  const now = useTicking(!!timer?.runningSince);
  if (!timer) return null;
  const left = clock(remainingMs(timer, now));
  const what = timer.kind === "focus" ? "Focus" : "Break";
  return (
    <button
      type="button"
      className="pp-glass pp-sync-pill pp-focus-pill"
      onClick={() => navigate("/focus")}
      aria-label={`${what}: ${left} left${timer.runningSince ? "" : ", paused"}. Open focus`}
    >
      {timer.runningSince ? <HourglassOutlined /> : <PauseOutlined />}
      <span className="pp-num">{left}</span>
    </button>
  );
}
