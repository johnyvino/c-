import { Film, Tv, Gamepad2 } from 'lucide-react';

export const TABS = ['Movies', 'Shows', 'Games'];
export const TYPE_FOR_TAB = { Movies: 'movie', Shows: 'show', Games: 'game' };
export const ICON_FOR_TAB = { Movies: Film, Shows: Tv, Games: Gamepad2 };

export const computeTabCounts = (moviesData) =>
  TABS.reduce((acc, id) => {
    const key = TYPE_FOR_TAB[id];
    acc[id] = moviesData.reduce((n, m) => (m.type === key ? n + 1 : n), 0);
    return acc;
  }, {});
