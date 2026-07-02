import { labelValue, labelsFromValues, savedDescription, savedRowStatus, savedRowValues } from "../helpers";
import type { SavedLive, SavedTrek } from "../types";

type Props = {
  saved: SavedTrek | null;
  liveMap: Record<string, SavedLive>;
  onClose: () => void;
};

export default function SavedTrekSheet({ saved, liveMap, onClose }: Props) {
  if (!saved) return null;

  const live = liveMap[saved.id];
  const rows = live?.result?.rows ?? saved.snapshotRows ?? [];
  const prediction = live?.predictionValues ?? saved.predictionValues;
  const latestDraw = live?.latestDraw ?? saved.savedLatestDraw;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <b>{saved.marketName}</b>
            <span>{savedDescription(saved)}</span>
          </div>
          <div className="sheet-actions">
            <button className="close-btn" type="button" onClick={onClose}>x</button>
          </div>
        </div>
        <div className="trek-detail">
          {rows.map((row, index) => (
            <div className="trek-row" key={`${row.displayDraw}-${index}`}>
              <span>{row.displayDraw}</span>
              <i>➜</i>
              <b className="row-digits">
                {savedRowValues(saved, row).map(({ digit, hit }, digitIndex) => (
                  <span key={`${digit}-${digitIndex}`} className={hit ? "hit-digit" : ""}>{labelValue(digit, saved.scanMode)}</span>
                ))}
              </b>
              <em>{savedRowStatus(saved, row)}</em>
            </div>
          ))}
          <div className="trek-row pending">
            <span>{latestDraw}</span>
            <i>➜</i>
            <b className="row-digits">
              {labelsFromValues(prediction, saved.scanMode).map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}
            </b>
            <em>??</em>
          </div>
        </div>
      </div>
    </div>
  );
}
