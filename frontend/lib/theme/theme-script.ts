import { THEME_STORAGE_KEY } from "./constants";

/**
 * Inline boot script: sets data-theme before paint to avoid flash.
 * Light only when explicitly stored or system prefers light and nothing stored.
 */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
