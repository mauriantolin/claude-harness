// Resolves a requested value against an option list.
//
// Exact value, label and text win first, so established case-sensitive value
// semantics are untouched. Only a miss falls back to whitespace-normalized
// text, and an ambiguous normalized match is rejected rather than guessed.
const normalize = (s) => s.replace(/\s+/g, " ").trim();

export function resolveOption(options, requested) {
  for (const option of options) {
    if (option.value === requested) return option;
    if (option.text === requested) return option;
  }

  const matches = options.filter(
    (option) => normalize(option.text) === normalize(requested),
  );
  if (matches.length === 1) return matches[0];
  return null;
}
