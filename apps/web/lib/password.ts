/**
 * Password strength estimation via zxcvbn-ts.
 *
 * We don't enforce specific character-class rules (uppercase, digit, symbol)
 * — per modern NIST 800-63B guidance those push users toward weaker
 * passwords like `Password1!`. We require a minimum length (12) and surface
 * an estimated-strength meter so users can self-correct.
 */

import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as en from '@zxcvbn-ts/language-en';

export const MIN_PASSWORD_LENGTH = 12;

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  zxcvbnOptions.setOptions({
    translations: en.translations,
    graphs: common.adjacencyGraphs,
    dictionary: {
      ...common.dictionary,
      ...en.dictionary,
    },
  });
  initialized = true;
}

export type PasswordStrength = {
  /** 0 (too guessable) to 4 (very unguessable). */
  score: 0 | 1 | 2 | 3 | 4;
  /** Short suggestion / warning to show the user. Empty string = no advice. */
  feedback: string;
};

const LABELS: Record<PasswordStrength['score'], string> = {
  0: 'Too weak',
  1: 'Weak',
  2: 'Okay',
  3: 'Strong',
  4: 'Very strong',
};

export function strengthLabel(score: PasswordStrength['score']): string {
  return LABELS[score];
}

export function estimateStrength(password: string): PasswordStrength {
  ensureInitialized();
  const result = zxcvbn(password);
  const fb = result.feedback;
  const feedback =
    fb.warning || fb.suggestions[0] || '';
  return {
    score: result.score as PasswordStrength['score'],
    feedback,
  };
}
