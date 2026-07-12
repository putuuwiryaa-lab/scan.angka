import type { BatchResult } from "../types";

type Props = {
  result: BatchResult | null;
  copied: boolean;
  onCopy: () => void;
};

function topText(ranks?: number[]) {
  const values = ranks?.length ? ranks : [1];
  return values.map((rank) => `Top ${rank}`).join("+");
}

export default function BatchOutputPanel({ result, copied, onCopy }: Props) {
  if (!result) return null;
  const meta = result.secondary
    ? `${result.results.length} pasaran · 2 metode`
    : result.adaptive
      ? `${result.results.length} pasaran · Turnamen Adaptif L14`
      : `${result.results.length} pasaran · ${topText(result.topRanks)}`;

  return (
    <section className="batch-panel">
      <p className="batch-meta">{meta}</p>
      <pre className="batch-output">{result.copyText}</pre>
      <button className="batch-copy" type="button" onClick={onCopy}>{copied ? "Tersalin" : "Copy Output"}</button>
    </section>
  );
}
