import ViennaMap from "./components/ViennaMap";

export default function HomePage() {
  return (
    <main className="hero" id="top">
      <ViennaMap key="wien-map-focus-v3" />

      <div className="hero-veil" aria-hidden />

      <header className="hero-copy">
        <p className="brand">Wien Mobility</p>
        <h1 className="headline">Die Stadt auf einen Blick.</h1>
        <p className="lead">
          Live-Verfügbarkeit und eigene Historie für WienMobil Rad.
        </p>
      </header>

      <p className="hero-credit">Karte · Wien im Fokus</p>
    </main>
  );
}
