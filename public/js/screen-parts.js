// Shared pieces used by every screen except Home.
import { esc } from './format.js';
import { icon } from './icons.js';

export function screenHead(ctx, location, titleKey) {
  const { t } = ctx;
  return `
    <header class="screen-head">
      <div>
        <h1>${esc(t(titleKey))}</h1>
        <button class="place-link" data-action="open-sheet" data-sheet="locations"
          aria-label="${esc(t('hero.changeLocation', { name: location.name }))}">
          ${icon('pin', 'icon-sm')}<span>${esc(location.name)}</span>${icon('chevron', 'icon-sm')}
        </button>
      </div>
      <button class="icon-button" data-action="open-sheet" data-sheet="settings" aria-label="${esc(t('hero.settings'))}">${icon('gear')}</button>
    </header>`;
}
