export const Footer = () => (
  <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="footer-row credits">
        <p>
          Designed and developed by{' '}
          <a
            href="https://johnyvino.com"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-author"
          >
            Johny Vino
          </a>
        </p>
        <p className="credits-line">
          Poster art and metadata from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>,{' '}
          <a href="https://rawg.io/" target="_blank" rel="noopener noreferrer">RAWG</a>,{' '}
          <a href="https://www.steamgriddb.com/" target="_blank" rel="noopener noreferrer">SteamGridDB</a>{' '}
          and{' '}
          <a href="https://www.watchmode.com/" target="_blank" rel="noopener noreferrer">Watchmode</a>.
        </p>
      </div>
    </div>
  </footer>
);
