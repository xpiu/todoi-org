/**
 * Runs in <head>, before first paint: stamps <html data-theme> from the saved
 * choice, or from the system preference with data-theme-source="system" so the
 * page keeps following it. Adds the `js` class the stylesheet keys on. The
 * storage key and attributes are the static site's, so returning visitors keep
 * their choice.
 */
export const THEME_KEY = 'todoi-theme';

export const themeScript = `(function(){var r=document.documentElement,t='light',s=null;r.className+=' js';try{s=localStorage.getItem('${THEME_KEY}');}catch(e){}if(s==='light'||s==='dark'){t=s;}else{r.setAttribute('data-theme-source','system');try{if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';}catch(e){}}r.setAttribute('data-theme',t);}());`;
