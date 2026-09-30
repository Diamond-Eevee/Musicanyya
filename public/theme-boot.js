(() => {
  try {
    const STORAGE_KEY = 'musicanyya.theme.v1';
    const VALID_THEMES = ['paper', 'ivory', 'slate', 'night', 'walnut', 'midnight'];
    let choice = 'auto';

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.version === 1) {
          if (parsed.choice === 'auto') {
            choice = 'auto';
          } else if (typeof parsed.choice === 'string' && VALID_THEMES.includes(parsed.choice)) {
            choice = parsed.choice;
          }
        }
      }
    } catch (_e) {
      // storage access may throw; fallback to auto
    }

    let theme = choice;
    if (choice === 'auto') {
      let dark = false;
      try {
        if (typeof matchMedia === 'function') {
          dark = !!matchMedia('(prefers-color-scheme: dark)').matches;
        }
      } catch (_e) {}
      theme = dark ? 'night' : 'paper';
    }

    const doc = document?.documentElement;
    if (doc) {
      doc.setAttribute('data-theme', theme);
      doc.setAttribute('data-theme-choice', choice);
    }
  } catch (_e) {}
})();
