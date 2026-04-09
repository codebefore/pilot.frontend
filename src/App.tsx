import { API_BASE_URL } from "./lib/api";

const navigationItems = [
  "Adaylar",
  "Gruplar",
  "Evrak",
  "Tahsilat",
  "MEB Gonderimi"
];

const candidateFields = [
  "Ad",
  "Soyad",
  "TC",
  "Telefon",
  "Dogum Tarihi"
];

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>Pilot</strong>
            <p>Gorev tabanli kurs operasyonu</p>
          </div>
        </div>

        <nav className="nav-list">
          {navigationItems.map((item) => (
            <button
              className={item === "Adaylar" ? "nav-item active" : "nav-item"}
              key={item}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="page-header">
          <div>
            <span className="eyebrow">Baslangic Iskeleti</span>
            <h1>Aday Akisi</h1>
            <p>
              Frontend renk ve ekran dili demo referansiyla ilerleyecek. Ilk
              dikey akis aday CRUD olacak.
            </p>
          </div>

          <div className="endpoint-card">
            <span>API</span>
            <code>{API_BASE_URL}</code>
          </div>
        </header>

        <section className="hero-grid">
          <article className="panel">
            <div className="panel-head">
              <h2>Ilk Ekranlar</h2>
              <span>React scaffold</span>
            </div>
            <ul className="simple-list">
              <li>Aday liste</li>
              <li>Yeni aday formu</li>
              <li>Aday detay</li>
              <li>Aday duzenleme</li>
            </ul>
          </article>

          <article className="panel panel-accent">
            <div className="panel-head">
              <h2>Minimum Aday Alanlari</h2>
              <span>Referans uygulama filtreli</span>
            </div>
            <div className="chip-list">
              {candidateFields.map((field) => (
                <span className="chip" key={field}>
                  {field}
                </span>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
