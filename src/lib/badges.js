// Single source of truth for poster badges, split by media type.
// Movies + shows share the same set; games have their own scheme.
//
// Order in each list defines BOTH the admin tray order AND priority on the
// card — the first key that's true wins. Note: the existing badge field name
// `nostalgic` is the movie/show variant; the games equivalent is `nostalgia`,
// stored under a different key so a movie can be `nostalgic` without
// implying it's the games-style badge.

export const BADGE_FIELDS_FILM = [
  { key: 'twist',            label: 'Twist',             img: '/badges/twist.png' },
  { key: 'scary',            label: 'Scary',             img: '/badges/scary.png' },
  { key: 'intense',          label: 'Intense',           img: '/badges/intense.png' },
  { key: 'mindbending',      label: 'Mind-bending',      img: '/badges/mindbending.png' },
  { key: 'mindblowing',      label: 'Mind-blowing',      img: '/badges/mindblowing.png' },
  { key: 'clever',           label: 'Clever',            img: '/badges/clever.png' },
  { key: 'thrilling',        label: 'Thrilling',         img: '/badges/thrilling.png' },
  { key: 'epic',             label: 'Epic',              img: '/badges/epic.png' },
  { key: 'mustsee',          label: 'Must-see',          img: '/badges/mustsee.png' },
  { key: 'visuallystunning', label: 'Visually stunning', img: '/badges/visuallystunning.png' },
  { key: 'heartwarming',     label: 'Heartwarming',      img: '/badges/heartwarming.png' },
  { key: 'emotional',        label: 'Emotional',         img: '/badges/emotional.png' },
  { key: 'inspiring',        label: 'Inspiring',         img: '/badges/inspiring.png' },
  { key: 'funny',            label: 'Funny',             img: '/badges/funny.png' },
  { key: 'nostalgic',        label: 'Nostalgic',         img: '/badges/nostalgic.png' },
  { key: 'rewatchable',      label: 'Rewatchable',       img: '/badges/rewatchable.png' },
  { key: 'unique',           label: 'Unique',            img: '/badges/unique.png' },
];

export const BADGE_FIELDS_GAMES = [
  { key: 'nostalgia',       label: 'Nostalgia',        img: '/badges/games/nostalgia.png' },
  { key: 'chargrowth',      label: 'Character growth', img: '/badges/games/chargrowth.png' },
  { key: 'difficulty',      label: 'Difficulty',       img: '/badges/games/difficulty.png' },
  { key: 'funfactor',       label: 'Fun factor',       img: '/badges/games/funfactor.png' },
  { key: 'replayvalue',     label: 'Replay value',     img: '/badges/games/replayvalue.png' },
  { key: 'immersiveworld',  label: 'Immersive world',  img: '/badges/games/immersiveworld.png' },
];

export const badgeFieldsFor = (type) =>
  type === 'game' ? BADGE_FIELDS_GAMES : BADGE_FIELDS_FILM;

export const pickPosterBadge = (movie) => {
  if (!movie) return null;
  for (const b of badgeFieldsFor(movie.type)) {
    if (movie[b.key]) return { src: b.img, alt: b.label };
  }
  return null;
};
