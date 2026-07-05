import type { BatchResult } from "../types";

type Props = {
  result: BatchResult | null;
  copied: boolean;
  onCopy: () => void;
};

export default function BatchOutputPanel({ result, copied, onCopy }: Props) {
  if (!result) return null;
  const topCount = result.stopScan ?? 1;
  const meta = result.secondary ? `${result.results.length} pasaran · 2 metode` : `${result.results.length} pasaran · Top ${topCount}`;

  return (
    <section className="batch-panel">
      <p className="batch-meta">{meta}</p>
      <pre className="batch-output">{result.copyText}</pre>
      <button className="batch-copy" type="button" onClick={onCopy}>{copied ? "Tersalin" : "Copy Output"}</button>
    </section>
  );
}