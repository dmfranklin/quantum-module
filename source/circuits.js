/**
 * circuits.js
 *
 * This file defines a Map of named circuits that can be referenced by string
 * identifiers when creating widgets in PreTeXt source files. Each key is a
 * descriptive name, and each value is either:
 *
 *   - a multiline ASCII diagram string (parsed by Q.js), or
 *   - a Q.Circuit instance
 *
 * These entries enable reusing circuit definitions across multiple exercises
 * by referring to their names in widget calls. For example:
 *
 * <interactive source="..." platform="javascript" aspect="9:9">
 *   <script>
 *     identicalCircuitWidget({ circuit: "Phi+", instantFeedback: true });
 *   </script>
 * </interactive>
 *
 * The widget loader will resolve the string "Phi+" by looking it up in this Map
 * and using its associated circuit definition when rendering the widget.
 */

const circuits = new Map([
  [
    "Q.js Example",
    `
        I I I   I I I
        I X X#0 I I I
        I I X#1 I I I
        I I I   I I I
      `,
  ],
  [
    "L1_2_0",
    `
        X X
      `,
  ],
  [
    "L1_2_1",
    `
        I S#0
        X S#1
      `,
  ],
  [
    "L1_2_2",
    `
        I X#0
        X X#1
      `,
  ],
  [
    "L2_1_0",
    `
        S#0
        S#1
      `,
  ],
  [
    "L2_1_1",
    `
        S#0
        S#1
      `,
  ],
  [
    "L2_3_2",
    `
        X#0
        X#1
      `,
  ],
  [
    "Lab 7 - Exercise 1",
    `
        X-I-I-X#1-S#0-X#1
        H-X-H-X#0-S#1-X#0
      `,
  ],
  [
    "X SWAP",
    `
        I I X S#0 I I
        I I I S#1 I I
      `,
  ],
  [
    "Blank 2x6",
    `
        I I I I I I
        I I I I I I
      `,
  ],
  [
    "Blank 1x6",
    `
        I I I I I I
      `,
  ],  [
    "Phi+",
    `
        H X#0 I I I I
        I X#1 I I I I
      `,
  ],
]);
