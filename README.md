# Quantum Book

This repository contains a work-in-progress interactive quantum computing textbook. The textbook itself is written in PreTeXt and the interactive widgets embedded within its lessons are written in JavaScript. The widgets integrate the Q.js quantum circuit editor, allowing students to build and analyze quantum circuits interactively.

## Building and Viewing the Textbook

To build and view the textbook locally, follow these steps:

1. Clone or download the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/AlexBuz/quantum-book.git
   cd quantum-book
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install PreTeXt:
   ```bash
   pip install pretext
   ```

4. Build the textbook for the web:
   ```bash
   pretext build web
   ```

5. View the textbook in a browser:
   ```bash
   pretext view web
   ```
   This will open the output in your browser. Alternatively, run:
   ```bash
   pretext view web --no-launch
   ```
   to start the server without automatically launching a browser. The textbook will be available at [http://localhost:8128/output/web](http://localhost:8128/output/web).

## Adding New Lessons

To add a new lesson:

- Create a new file (e.g., `lesson2.ptx`) in the `source` directory.
- Copy the structure of `lesson1.ptx`, updating the `xml:id` to match the new file name.
- Write the content of the lesson using PreTeXt syntax.
- Add a link to the new lesson in `lessons.ptx` by including:

  ```xml
  <xi:include href="lesson2.ptx" />
  ```

After making changes, rebuild the textbook using `pretext build web` and reload the page in your browser to see the updated content.

Alternatively, you may use a tool like `watchexec` to automatically rebuild the textbook as you make changes. This way, you'll only need to refresh the page in your browser to see the updated content. To install `watchexec` using Homebrew, run:

```bash
brew install watchexec
```

Then, run the following command in the project directory to watch for changes in the `source` directory and rebuild the textbook automatically:

```bash
watchexec -w source -- pretext build web
```

## Integrating Interactive Widgets

Each interactive widget in the textbook is created by embedding a JavaScript function call within a `<script>` block inside a PreTeXt `<interactive>` element. These functions render different types of exercises, allowing students to construct, modify, and analyze quantum circuits. See [below](#template-for-including-widgets) for a concrete example of how to include a widget in a lesson.

### Available Widgets

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

### Widget Parameters

Each widget function accepts an `options` object. The parameters vary slightly depending on the function being used.

### Parameters for `identicalCircuitWidget`, `equivalentCircuitWidget`, `matchOutputWidget`, `specificOutputWidget`

- **`circuit`** (required):
  Defines the target circuit that students must recreate, match, or modify. It can be:
  - A string identifier referring to a predefined circuit (e.g., `"Phi+"`) defined in the `cicuitDiagrams` object in `source/widget.js`.
  - A circuit specified using any syntax supported by `Q.js`. See the [Q.js documentation](https://github.com/stewdio/q.js/tree/master#quantum-javascript) for details.

- **`instantFeedback`** (optional, default: `false`):
  If `true`, the widget automatically checks the student's work after every change. If `false`, a manual "Check Answer" button is provided.

- **`allowedGates`** (optional, default: `"HXYZPT*"`):
  A string specifying which gate symbols students are allowed to use when constructing their circuit.

### Parameters for `visualizeProbabilitiesWidget`

- **`circuit`** (required):
  Defines the initial quantum circuit displayed in the widget. It can be a predefined identifier, an inline diagram, or a circuit object.

- **`allowedGates`** (optional, default: `"HXYZPT*"`):
  Specifies which gates can be used when modifying the circuit.

### Template for Including Widgets

To include an interactive circuit exercise in a lesson, follow the template below, replacing `identicalCircuitWidget` with the desired widget function and parameters.

```xml
<interactive aspect="9:9" platform="javascript" source="../../../source/loader.js">
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
