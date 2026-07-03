import { detailHeaderTitle, labelValue, rowStatus, rowValues, scanDescription } from "../helpers";
import type { Market, ScanItem, ScanRow } from "../types";

type Props = {
  item: ScanItem | null;
  selectedMarket: Market | null;
  marketName: string;
  digitCount: number;
  resultDigitCount?: number;
  rows: ScanRow[];
  nextPredictionLabels: string[];
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
};

export default function TrekDetailSheet({ item, selectedMarket, marketName, digitCount, resultDigitCount, rows, nextPredictionLabels, copied, onCopy, onClose }: Props) {
  if (!item) return null;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <b>{detailHeaderTitle(marketName, selectedMarket)}</b>
            <span>{scanDescription(item.scanMode, item.targetPos, item.target2D, resultDigitCount ?? digitCount, item.target3D)}</span>
          </div>
          <div className="sheet-actions">
            <button className="copy-btn" type="button" onClick={onCopy}>{copied ? "Tersalin" : "Salin Trek"}</button>
            <button className="close-btn" type="button" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="trek-detail">
          {rows.map((row, index) => (
            <div className="trek-row" key={`${row.displayDraw}-${index}`}>
              <span>{row.displayDraw}</span>
              <i>➜</i>
              <b className="row-digits">
                {rowValues(item, row).map(({ digit, hit }, digitIndex) => <span key={`${digit}-${digitIndex}`} className={hit ? "hit-digit" : ""}>{labelValue(digit, item.scanMode)}</span>)}
              </b>
              <em>{rowStatus(item, row)}</em>
            </div>
          ))}
          <div className="trek-row pending">
            <span>{item.result.latestDraw}</span>
            <i>➜</i>
            <b className="row-digits">
              {nextPredictionLabels.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}
            </b>
            <em>??</em>
          </div>
        </div>
      </div>
    </div>
  );
}
