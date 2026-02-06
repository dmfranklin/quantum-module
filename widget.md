# Interactive Widget

Each interactive widget in the textbook is created by embedding a JavaScript function call within a `<script>` block inside a PreTeXt `<interactive>` element. These functions render different types of exercises, allowing students to construct, modify, and analyze quantum circuits. [Read more](#template-for-including-widgets) for a concrete example of how to include a widget in a lesson.

## Available Widgets

1. **`identicalCircuitWidget(options)`**
   Displays a target circuit and asks students to recreate it exactly. The widget provides feedback on whether the student's circuit matches the target.

2. **`equivalentCircuitWidget(options)`**
   Presents a circuit and asks students to construct an equivalent circuit using fewer gates. The student's circuit must produce the same output state as the target circuit for all possible input states.

3. **`matchOutputWidget(options)`**
   Displays a given circuit along with its input state and requires students to construct a new circuit that produces the same output state for the given input state while using fewer gates.

4. **`specificOutputWidget(options)`**
   Requires students to create a circuit that transforms an initial state into a specific target output state. Unlike `matchOutputWidget`, the expected final state is explicitly given rather than derived from an existing circuit.

5. **`visualizeProbabilitiesWidget(options)`**
   Displays a quantum circuit and dynamically updates a probability distribution based on the current circuit configuration. Students can modify the circuit and immediately see how the probabilities of different measurement outcomes change.

## Specifying a Circuit

All widgets need the ability to specify a circuit.
The gate abbreviations are:

- I: Identity (wire with no gate to line up timing)
- X: NOT / X
- Y: Y
- S: SWAP

To specify a two-qubit gate:

- Use #0 and #1 to indicate the two inputs
- Some gates are symmetric (S) but others are asymmetric (CNOT)
- Using #0 and #1 on a one-qubit gate turns it into a C-Gate, where
  #0 is the control and #1 is the target. (e.g., X#0 and X#1 is a CNOT)

Gates must be given a name and defined in the `circuits` variable in `source/circuits.js`.

For example, to define the circuit "Phi+", consisting of an X gate on the top line followed by a CNOT (top line is control, bottom line is target), with 4 empty columns to the right, you would write:

```js
[
  "Phi+",
  `
    H X#0 I I I I
    I X#1 I I I I
  `,
],
```

## Widget Parameters

Each widget function accepts an `options` object. The parameters vary slightly depending on the function being used.

### Parameters for `identicalCircuitWidget`, `equivalentCircuitWidget`, `matchOutputWidget`, `specificOutputWidget`

- **`circuit`** (required):
  Defines the target circuit that students must recreate, match, or modify. It can be:
  - A string identifier referring to a predefined circuit (e.g., `"Phi+"`) defined in the `cicuitDiagrams` object in `source/widget.js`.
  - A circuit specified using any syntax supported by `Q.js`. See the [Q.js documentation](https://github.com/stewdio/q.js/tree/master#quantum-javascript) for details.

- **`instantFeedback`** (optional, default: `false`):
  If `true`, the widget automatically checks the student's work after every change. If `false`, a manual "Check Answer" button is provided.

- **`allowedGates`** (optional, default: `"HXYZPTS*"`):
  A string specifying which gate symbols students are allowed to use when constructing their circuit.

- **`code`** (optional, default: `false`):
  If `true`, a code editor is displayed instead of a gate palette. This makes it so that students must specify the circuit using Qiskit-like syntax instead of dragging and dropping gates.

#### Additional Parameters for `matchOutputWidget`, `specificOutputWidget`

- **`inputs`** (optional, default: `"0"`):
  A string specifying the input for the circuit. Recognized input states include `"0"`, `"1"`, `"+"`, and `"-"`. The string can either be of length 1, in which case all qubits are initialized to this state, or as long as the number of qubits in the circuit, in which case the qubits are initialized from top to bottom.

### Parameters for `visualizeProbabilitiesWidget`

- **`circuit`** (required):
  Defines the initial quantum circuit displayed in the widget. It can be a predefined identifier, an inline diagram, or a circuit object.

- **`allowedGates`** (optional, default: `"HXYZPTS*"`):
  Specifies which gates can be used when modifying the circuit.

- **`inputs`** (optional, default: `"0"`):
  A string specifying the input for the circuit. Recognized input states include `"0"`, `"1"`, `"+"`, and `"-"`. The string can either be of length 1, in which case all qubits are initialized to this state, or as long as the number of qubits in the circuit, in which case the qubits are initialized from top to bottom.

## Template for Including Widgets

To include an interactive circuit exercise in a lesson, follow the template below, replacing `identicalCircuitWidget` with the desired widget function and parameters.

```xml
<interactive aspect="9:9" platform="javascript" source="https://cdn.jsdelivr.net/gh/dmfranklin/quantum-module/source/loader.js">
  <script>
    identicalCircuitWidget({
      circuit: "Phi+",
      instantFeedback: true,
      allowedGates: "HX*"
    });
  </script>
</interactive>
```

This example loads the circuit named `"Phi+"` (which is defined in `source/widget.js`), requires students to recreate it exactly, and provides instant feedback on their progress.

Note that it is important to leave the `source` attribute of the `<interactive>` element unchanged, as it loads the necessary JavaScript code for the widget. Similarly, the `platform` attribute should always be set to `"javascript"`. . The `aspect` attribute specifies the initial size of the widget frame, and it is automatically adjusted to fit the content once the widget is rendered, so setting it only affects the initial layout of the page.

## Template for Using Widgets in Exercises

To create an exercise that uses the widget (using any of the widget functions except for `visualizeProbabilitiesWidget`), wrap the `<interactive>` tag in an `<exercise>` tag as follows:

```xml
<exercise label="my-circuit-exercise">
  <title>Circuit Exercise</title>
  <dynamic>
    <statement>
      <interactive
          aspect="9:9"
          platform="javascript"
          source="https://cdn.jsdelivr.net/gh/dmfranklin/quantum-module/source/loader.js">
        <script>
          identicalCircuitWidget({
            circuit: "Phi+",
            instantFeedback: true,
            allowedGates: "HX*"
          });
        </script>
      </interactive>
    </statement>
  </dynamic>
  <static>
    <statement>
      <p>Match circuits.</p>
    </statement>
  </static>
</exercise>
```

This uses a type of exercise called a "dual" exercise. "Dual" exercises are required to embed custom interactives like our widget. The `<static>` section of the exercise is shown in case JavaScript is not supported on the student's computer, but this is extremely unlikely. The `<interactive>` element is placed in the `<dynamic>` section of the exercise, and a text-based alternative can be placed in the `<static>` section of the exercise.

## Code Structure

The following files power the interactive widgets in this textbook, and they are all located in the `source` directory:

- **`loader.js`**
  This is the entry point for all widgets. It runs inside each PreTeXt `<interactive>` element and dynamically loads everything needed into the iframe (i.e., Q.js, the widget code, CSS, and any other dependencies). It then evaluates the `<script>` block embedded in the lesson source, which is expected to call one of the widget creation functions (like `identicalCircuitWidget`).

- **`widget.js`**
  This file defines all of the custom widget types, like identical circuit matching, output matching, probability visualizations, etc. It also patches Q.js at runtime to fix some bugs and add new behavior (like control/SWAP toggles, better error handling, Unicode gate symbols, etc.). The patching is done non-destructively: instead of modifying Q.js directly, `widget.js` replaces specific methods on Q.js classes as needed.

- **`circuits.js`**
  A registry of reusable named circuits. Each entry maps a string (like `"Phi+"`) to a Q.js-compatible circuit definition. This makes it easy to refer to circuits from within widget calls in the PreTeXt source without duplicating circuit data.

- **`widget.css`**
  Styles for the widgets, including feedback messages, buttons, and circuit colors.
