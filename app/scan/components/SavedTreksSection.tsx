import { ROW_ACTIONS_STYLE, SECTION_COUNT_STYLE, SECTION_LINE_STYLE, SECTION_TITLE_STYLE } from "../constants";
import { analysisTitle, isShioMode, labelsFromValues } from "../helpers";
import type { SavedGroup, SavedLive, SavedTrek } from "../types";

type Props = {
  total: number;
  groups: SavedGroup[];
  liveMap: Record<string, SavedLive>;
  onView: (saved: SavedTrek) => void;
  onDelete: (id: string) => void;
};

export default function SavedTreksSection({ total, groups, liveMap, onView, onDelete }: Props) {
  if (total === 0) return null;

  return (
    <>
      <div style={SECTION_TITLE_STYLE}>
        <span style={SECTION_LINE_STYLE} />
        <b>Trek Tersimpan</b>
        <em style={SECTION_COUNT_STYLE}>{total} trek</em>
        <span style={SECTION_LINE_STYLE} />
      </div>

      {groups.map((group) => (
        <div className="panel result-panel" key={group.key}>
          <p className="summary">
            <b>{group.marketName}</b> &middot; <b>{analysisTitle(group.scanMode, group.targetPos, group.target2D)}</b> &middot; {group.digitCount} {isShioMode(group.scanMode) ? "shio" : "digit"} &middot; {group.L} data &middot; {group.items.length} hasil
          </p>
          <div className="scan-list compact-list">
            {group.items.map((saved) => {
              const live = liveMap[saved.id];
              const values = live?.predictionValues ?? saved.predictionValues;
              return (
                <div className="scan-item compact" key={saved.id}>
                  <span className="scan-formula compact-formula">{saved.formula}</span>
                  <div className="compact-digits">
                    {labelsFromValues(values, saved.scanMode).map((digit, digitIndex) => <span key={`${digit}-${digitIndex}`}>{digit}</span>)}
                  </div>
                  <div style={ROW_ACTIONS_STYLE}>
                    <button className="view-btn compact-view" type="button" onClick={() => onView(saved)}>Lihat</button>
                    <button className="view-btn compact-view" type="button" onClick={() => onDelete(saved.id)}>Hapus</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
