// Resolves a requested value against an option list.
export function resolveOption(options, requested) {
  for (const option of options) {
    if (option.value === requested) return option;
    if (option.text === requested) return option;
  }
  return null;
}
