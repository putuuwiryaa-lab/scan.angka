import type { BatchResult } from "../types";

type Props = {
  result: BatchResult | null;
  copied: boolean;
  onCopy: () => void;
};

export default function BatchOutputPanel({ result, copied, onCopy }: Props) {
  if (!result) return null;
  const topCount = result.stopScan ?? 1;

  return (
    <section className="batch-panel">
      <p className="batch-meta">{result.results.length} pasaran · Top {topCount}</p>
      <pre className="batch-output">{result.copyText}</pre>
      <button className="batch-copy" type="button" onClick={onCopy}>{copied ? "Tersalin" : "Copy Output"}</button>
    </section>
  );
}