import type { CSSProperties } from "react";

export {
  ANALYSIS_OPTIONS,
  POS_OPTIONS,
  TARGET_2D_OPTIONS,
  LABEL,
  ANALYSIS_LABEL,
  TARGET_2D_LABEL,
  DIGIT_OPTIONS,
} from "../shared/scan-options";

export const SAVED_TREK_KEY = "scan-angka:saved-treks:v2";
export const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const SHIO_COLS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];

export const NO_BADGE_SELECT_STYLE: CSSProperties = { gridTemplateColumns: "minmax(0,1fr) 24px" };
export const NO_BADGE_OPTION_STYLE: CSSProperties = { gridTemplateColumns: "minmax(0,1fr) auto" };
export const DATA_HINT_FIELD_STYLE: CSSProperties = { position: "relative" };
export const DATA_HINT_INPUT_STYLE: CSSProperties = { paddingRight: 76 };
export const DATA_HINT_STYLE: CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: 14,
  color: "rgba(233,238,245,.34)",
  fontSize: 12,
  fontWeight: 900,
  pointerEvents: "none",
};
export const ROW_ACTIONS_STYLE: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  alignItems: "center",
};
export const SECTION_TITLE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "18px 0 10px",
  color: "#e9eef5",
  fontSize: 15,
  fontWeight: 950,
};
export const SECTION_LINE_STYLE: CSSProperties = {
  flex: 1,
  height: 1,
  background: "rgba(255,255,255,.10)",
};
export const SECTION_COUNT_STYLE: CSSProperties = {
  color: "#8b97a8",
  fontSize: 13,
  fontWeight: 900,
};
