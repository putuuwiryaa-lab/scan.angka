const APPS = [
  { name: "Analisa Angka", href: "https://analisa-angka.site" },
  { name: "Angka Pro", href: "https://angkapro.online" },
];

export default function AppPromoBanner() {
  return (
    <section className="app-tools" aria-label="Tools tambahan">
      <span className="app-tools-label">Tools tambahan</span>
      <div className="app-tools-links">
        {APPS.map((app) => (
          <a key={app.name} href={app.href} target="_blank" rel="noopener noreferrer">
            {app.name}
          </a>
        ))}
      </div>
    </section>
  );
}
