const APPS = [
  {
    name: "Analisa Angka",
    badge: "PREMIUM",
    description: "AI, BBFS, OFF, Jumlah, Shio, Rekap, Statistik, dan Invest 2D.",
    href: "https://analisa-angka.site",
  },
  {
    name: "Angka Pro",
    badge: "RANKING",
    description: "Pantauan prediksi ringan dengan ranking AI4, CT6, BBFS, dan TOP8 2D.",
    href: "https://angkapro.online",
  },
];

export default function AppPromoBanner() {
  return (
    <section className="app-promo" aria-label="Aplikasi lainnya">
      <div className="app-promo-head">
        <div>
          <div className="app-promo-kicker">Aplikasi Lainnya</div>
          <h2>Lengkapi Analisa</h2>
        </div>
        <span>2 Tools</span>
      </div>

      <div className="app-promo-grid">
        {APPS.map((app) => (
          <a key={app.name} className="app-promo-card" href={app.href} target="_blank" rel="noopener noreferrer">
            <div className="app-promo-card-top">
              <b>{app.name}</b>
              <em>{app.badge}</em>
            </div>
            <p>{app.description}</p>
            <strong>Buka →</strong>
          </a>
        ))}
      </div>
    </section>
  );
}
