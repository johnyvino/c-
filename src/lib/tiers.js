// Personal-rating tiers shown on the public site (filter slider).
export const MY_SCORE_TIERS = [
  { label: 'Any',     min: 0 },
  { label: 'Good',    min: 7 },
  { label: 'Great',   min: 8 },
  { label: 'Amazing', min: 9 },
];

// Tiers used in the admin to set a numeric score on a card.
export const SCORE_TIERS = [
  { label: 'Clear',   value: null, hint: 'No score' },
  { label: 'Good',    value: 7,    hint: '7.0' },
  { label: 'Great',   value: 8,    hint: '8.0' },
  { label: 'Amazing', value: 9.2,  hint: '9.2' },
];

export const tierLabelFor = (score) => {
  if (score == null) return null;
  if (score >= 9) return 'Amazing';
  if (score >= 8) return 'Great';
  if (score >= 7) return 'Good';
  return null;
};
