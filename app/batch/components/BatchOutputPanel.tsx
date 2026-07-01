import type { BatchResult } from "../types";

type Props = {
  result: BatchResult | null;
  copied: boolean;
  onCopy: () => void;
};

export default function BatchOutputPanel({ result, copied, onCopy }: Props) {
  if (!result) return null;

  return (
    <section className="batch-panel">
      <p className="batch-meta">{result.results.length} pasaran · stop scan otomatis 1</p>
      <pre className="batch-output">{result.copyText}</pre>
      <button className="batch-copy" type="button" onClick={onCopy}>{copied ? "Tersalin" : "Copy Output"}</button>
    </section>
  );
}
