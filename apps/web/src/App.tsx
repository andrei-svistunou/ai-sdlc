export function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <a className="brand" href="#overview" aria-label="AI SDLC Platform home">
          <span className="brand-mark" aria-hidden="true">
            AI
          </span>
          <span>AI SDLC Platform</span>
        </a>

        <nav aria-label="Primary navigation">
          <a href="#overview">Overview</a>
        </nav>
      </header>

      <main id="main-content" className="site-main" tabIndex={-1}>
        <section id="overview" className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">Local workflow control plane</p>
            <h1 id="page-title">AI SDLC Platform</h1>
            <p className="hero-description">
              A deterministic workspace for moving software tasks from analysis to a human-ready
              review.
            </p>
            <div className="hero-meta" aria-label="Platform status">
              <span className="status-dot" aria-hidden="true" />
              <span>Repository foundation ready</span>
            </div>
          </div>

          <div className="workflow-card" aria-label="Workflow preview">
            <div className="workflow-card-header">
              <span className="card-label">V0.1 workflow</span>
              <span className="card-version">local</span>
            </div>
            <ol className="workflow-list">
              <li>
                <span className="step-number">01</span>
                <span>
                  <strong>Analyze</strong>
                  <small>Understand the task</small>
                </span>
              </li>
              <li>
                <span className="step-number">02</span>
                <span>
                  <strong>Plan</strong>
                  <small>Shape the solution</small>
                </span>
              </li>
              <li>
                <span className="step-number">03</span>
                <span>
                  <strong>Approve</strong>
                  <small>Keep decisions human-owned</small>
                </span>
              </li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Built for deliberate delivery.</span>
        <span>Foundation task · 001</span>
      </footer>
    </div>
  );
}
