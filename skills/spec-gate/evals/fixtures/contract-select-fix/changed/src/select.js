// Resolves a requested value against an option list.
//
// Exact matches win first; a miss falls back to whitespace-normalized,
// case-folded text so that user-typed labels resolve.
const normalize = (s) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function resolveOption(options, requested) {
  for (const option of options) {
    if (option.value === requested) return option;
    if (option.text === requested) return option;
  }
  const wanted = normalize(requested);
  for (const option of options) {
    if (normalize(option.text) === wanted) return option;
  }
  return null;
}
