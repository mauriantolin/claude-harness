# Contract: resolve labels that differ only by whitespace

Issue: a label rendered with a non-breaking space ("Capital\u00A0Federal") is
not found when the caller types an ASCII space ("Capital Federal").

## Acceptance

| ID | Level | Requirement |
|---|---|---|
| A1 | Must-have | A request whose whitespace differs from the label's whitespace resolves that option. |
| A2 | Must-have | An exact value match still wins over any text or normalized match. |
| A3 | Must-have | When whitespace normalization makes two or more options indistinguishable, the resolver returns null instead of choosing one. |

## Must not change

| ID | Behavior |
|---|---|
| M1 | Matching stays case-sensitive. "capital federal" does not resolve "Capital Federal". |
| M2 | An option without a `text` field still resolves by `value`. |

## Proof commands

- `node tests/select.test.js` exits 0.
