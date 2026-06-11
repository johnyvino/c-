// Maps RAWG parent_platform.slug and store.slug to display label + an optional
// branded icon source. Some gaming brands (PlayStation, Xbox, Nintendo) were
// removed from simple-icons, so we use Google's favicon service via
// `iconDomain` for those. PC/Web/Linux fall back to a lucide Icon.

import { Globe, Monitor } from 'lucide-react';

export const PLATFORM_META = {
  pc:          { label: 'PC',          Lucide: Monitor },
  playstation: { label: 'PlayStation', iconDomain: 'playstation.com' },
  xbox:        { label: 'Xbox',        iconDomain: 'xbox.com' },
  nintendo:    { label: 'Nintendo',    iconDomain: 'nintendo.com' },
  mac:         { label: 'Mac',         simpleIcon: 'apple' },
  linux:       { label: 'Linux',       simpleIcon: 'linux' },
  android:     { label: 'Android',     iconDomain: 'android.com' },
  ios:         { label: 'iOS',         iconDomain: 'apple.com' },
  web:         { label: 'Web',         Lucide: Globe },
};

// Slugs that shouldn't be offered as a filter chip — too granular or
// duplicate-ish in normal browsing. Detail modal can still show them.
export const HIDDEN_PLATFORM_SLUGS = new Set(['mac', 'linux', 'web']);

export const STORE_META = {
  steam:               { label: 'Steam',           simpleIcon: 'steam' },
  gog:                 { label: 'GOG',             simpleIcon: 'gogdotcom' },
  'playstation-store': { label: 'PlayStation',     simpleIcon: 'playstation' },
  'xbox-store':        { label: 'Microsoft Store', simpleIcon: 'xbox', hidden: true },
  xbox360:             { label: 'Xbox',            simpleIcon: 'xbox' },
  nintendo:            { label: 'Nintendo',        simpleIcon: 'nintendoswitch' },
  'epic-games':        { label: 'Epic',            simpleIcon: 'epicgames' },
  itch:                { label: 'itch.io',         simpleIcon: 'itchdotio' },
  'google-play':       { label: 'Google Play',     simpleIcon: 'googleplay' },
  'apple-appstore':    { label: 'App Store',       simpleIcon: 'appstore' },
};

export const simpleIconUrl = (slug, color = 'ffffff') =>
  `https://cdn.simpleicons.org/${slug}/${color}`;

export const faviconUrl = (domain) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

