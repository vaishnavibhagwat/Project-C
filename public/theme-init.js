// Runs before first paint (classic, render-blocking script from this origin, so it is allowed
// by the CSP). Applies the theme the user last saw; first-time visitors get the default from
// VITE_DEFAULT_THEME, whose tokens are pre-declared in src/theme/global.css.
(function () {
  var root = document.documentElement;
  try {
    var cached = JSON.parse(localStorage.getItem('meridian:theme-vars') || 'null');
    if (cached && typeof cached.vars === 'object') {
      for (var name in cached.vars) {
        if (
          /^--color-[a-z0-9-]+$/.test(name) &&
          /^\d{1,3} \d{1,3} \d{1,3}$/.test(cached.vars[name])
        ) {
          root.style.setProperty(name, cached.vars[name]);
        }
      }
      if (cached.mode === 'light' || cached.mode === 'dark') {
        root.dataset.themeMode = cached.mode;
        root.style.colorScheme = cached.mode;
      }
      return;
    }
  } catch (e) {
    /* storage unavailable: fall through to the default theme */
  }
  var meta = document.querySelector('meta[name="meridian-default-theme"]');
  var setting = meta ? meta.getAttribute('content') : '';
  var ids = { light: 'porcelain', dark: 'midnight-graphite' };
  var id = ids[setting] || setting;
  if (id === 'porcelain' || id === 'high-contrast') root.dataset.bootTheme = id;
})();
