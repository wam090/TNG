// Mechanically enforces the CLAUDE.md hard rules. These rules protect
// architecture decisions, not style preferences — do not weaken or waive them.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // CLAUDE.md rules 3 & 4: the wall clock and unseeded randomness are banned
  // in gameplay code. core/Time.ts and core/Rng.ts are the only doors.
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG in core/Rng.ts. CLAUDE.md rule 4.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'The wall clock lives in core/Time.ts only. CLAUDE.md rule 3.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'The wall clock lives in core/Time.ts only. CLAUDE.md rule 3.',
        },
      ],
    },
  },
  {
    files: ['src/core/Rng.ts', 'src/core/Time.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  // SPEC.md §2.3 — the most important rule in this config. Props and player
  // code react to events and tags; element names must never appear there.
  {
    files: ['src/world/props/**/*.ts', 'src/player/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^(wind|fire|water|earth)$/]',
          message: 'Props react to events and tags, never to element names. See SPEC.md §2.3.',
        },
        {
          selector: 'TemplateElement[value.cooked=/^(wind|fire|water|earth)$/]',
          message: 'Props react to events and tags, never to element names. See SPEC.md §2.3.',
        },
      ],
    },
  },

  // The config file itself is plain JS — no type info available for it.
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
