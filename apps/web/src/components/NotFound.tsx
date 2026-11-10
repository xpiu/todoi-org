/** The static site's 404 page: same copy, same hero layout, kept out of the index. */
export function NotFound() {
  return (
    <>
      <title>Page not found · todoi.org</title>
      <meta name="robots" content="noindex" />
      <main className="hero">
        <div className="shell">
          <p className="hero-meta">todoi.org · 404</p>
          <h1 className="hero-title">Page not found</h1>
          <p className="hero-lede">
            This address does not point to a page or download. Browse the directory to find a task manager or the
            latest dataset.
          </p>
          <p className="contribute-actions">
            <a className="btn btn-primary" href="/">
              Back to the directory
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
