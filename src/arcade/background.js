export function watchGameBackground(page, browser, onBackground) {
  const onVisibility = () => { if (page.hidden) onBackground(); };
  page.addEventListener('visibilitychange', onVisibility);
  browser.addEventListener('pagehide', onBackground);
  return () => {
    page.removeEventListener('visibilitychange', onVisibility);
    browser.removeEventListener('pagehide', onBackground);
  };
}
