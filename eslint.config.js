// Mechanically enforces the CLAUDE.md hard rules. These rules protect
// architecture decisions, not style preferences — do not weaken or waive them.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ELEMENT_NAMES = 'wind|fire|water|earth';
const TAGS = 'light|heavy|air|burning|wet|earthen'; // SPEC §8.6 Tag union

/** Ban a set of bare string literals, in both quote and template form. */
const banLiterals = (alternation, message) => [
  { selector: `Literal[value=/^(${alternation})$/]`, message },
  { selector: `TemplateElement[value.cooked=/^(${alternation})$/]`, message },
];

const ELEMENT_MSG =
  'Props and player code react to events and quantities, never to element names. See SPEC.md §2.3.';
const TAG_MSG =
  'Props may not branch on TAGS either — a tag check is element identity through the back door. ' +
  'React to events, quantities (force, mass), signals and overlap. WO-003.';

// CLAUDE.md Stack: "No physics engine." This turns that from a grep into a rule.
const PHYSICS_IMPORTS = [
  '@dimforge/*',
  'cannon*',
  'ammo*',
  'oimo*',
  'three/examples/jsm/physics/*',
  'three/addons/physics/*',
];

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

  // SPEC.md §2.3 — the most important rule in this config. Player code may
  // read tags (it owns the loadout); element NAMES must never appear.
  {
    files: ['src/player/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...banLiterals(ELEMENT_NAMES, ELEMENT_MSG)],
    },
  },

  // Props are held to the stricter bar (WO-003): no element names AND no tags.
  // A windmill knows it got pushed. It does not know what pushed it, and it
  // does not get to ask whether the pusher was 'air'.
  {
    files: ['src/world/props/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...banLiterals(ELEMENT_NAMES, ELEMENT_MSG),
        ...banLiterals(TAGS, TAG_MSG),
      ],
    },
  },

  // CLAUDE.md Stack: "No physics engine." Mechanically enforced, not grepped.
  {
    files: ['src/**/*.ts', 'tools/**/*.mjs'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PHYSICS_IMPORTS,
              message:
                'No physics engine. Collision is hand-rolled over three-mesh-bvh (SPEC §8.3). ' +
                'If you think you need one, stop and ask — CLAUDE.md hard rule 1.',
            },
          ],
        },
      ],
    },
  },

  // Plain JS (this config, node tooling) — no type info available for it.
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Node tooling scripts mix node globals with in-page (browser) evaluate
  // callbacks; no-undef would need both global sets. TS owns src/ safety —
  // tools are plain scripts, so no-undef is off there and nowhere else.
  {
    files: ['tools/**/*.mjs'],
    rules: { 'no-undef': 'off' },
  },
);
