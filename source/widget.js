// Make Q.js available to code running inside the parent page (useful for debugging)
window.parent.Q = Q;

// MARK: - patch Q.js to fix bugs and add features

/**
 * patchMethod:
 *   Dynamically replaces a method on an object by converting its current
 *   implementation to a string, applying regex-based replacements, then
 *   reassigning the modified function, preserving property descriptors.
 *
 * object:       the object containing the method to patch (e.g., Q.Matrix)
 * methodName:   the name of the method to patch (string)
 * replacements: an array of [RegExp_or_string, replacementString] pairs
 */
const patchMethod = (object, methodName, replacements) => {
  // Grab the original function source as text
  const newMethod = eval(
    `(${replacements.reduce(
      (source, [regex, replacement]) => source.replace(regex, replacement),
      object[methodName].toString()
    )})`
  );
  // Preserve any existing property descriptors on the patched function
  Object.defineProperties(
    newMethod,
    Object.getOwnPropertyDescriptors(object[methodName])
  );
  object[methodName] = newMethod;
};

// Fix bug in Q.Matrix.multiplyTensor so it uses matrix1's dimensions (not matrix0's) when computing floor divisions for row/column indices
patchMethod(Q.Matrix, "multiplyTensor", [
  [
    // In the original implementation, the code did `Math.floor(x / matrix0.columns.length)` and
    // `Math.floor(y / matrix0.rows.length)`, which is incorrect. For a proper Kronecker product,
    // those divisions must use matrix1's dimensions. This replacement changes `matrix0.columns.length`
    // to `matrix1.columns.length` and `matrix0.rows.length` to `matrix1.rows.length` in the index calculations.
    /(?<=matrix0[XY] = Math\.floor\( [xy] \/ matrix)0(?=\.(columns|rows).length \))/g,
    "1",
  ],
]);

// Patch Q.Circuit.evaluate to:
//    a) fix bug that ignored the initial qubit state
//    b) fix bug causing SWAP gates to not function correctly
//    c) store the entire circuit matrix instead of just final qubit state
patchMethod(Q.Circuit, "evaluate", [
  // a) Replace creation of default state with combining all qubits' row vectors
  [
    /const state = .*\s*state.write\$\( 0, 0, 1 \)/,
    `
    const state = circuit.inputState = circuit.qubits.reduce( function( state, qubit ){
			return state.multiplyTensor(new Q.Matrix( ...qubit.rows ))
		}, new Q.Matrix( [ 1 ] ))
    `,
  ],

  // b) Fix the loop bounds so that SWAP gates iterate correctly over target indices
  [
    "for( let j = 0; j < operation.registerIndices.length - 1; j ++ )",
    "for( let j = operation.registerIndices.length - Math.log2( U.getWidth() ); j > 0; j -- )",
  ],

  // c) When evaluating, create a full identity matrix of size 2^bandwidth rather than just tracking the qubit state
  [
    "}, state )",
    "}, Q.Matrix.createIdentity( Math.pow( 2, circuit.bandwidth )))",
  ],
  // Also record circuit.outputState by multiplying the full circuit matrix by the initial state
  [
    /(?<=const outcomes = )matrix(?=\.rows\.reduce)/,
    "(circuit.outputState = matrix.multiply( state ))",
  ],
]);

// Wrap the original Q.Circuit.evaluate to add pre-flight validation:
// - Ensure "Control" gates actually have targets connected
// - Ensure the number of qubits matches the expected gate arity
Q.Circuit.evaluate = ((origEvaluate) =>
  function (circuit) {
    for (const operation of circuit.operations) {
      // Disallow a cursor (control) gate with no target
      if (operation.gate.symbol == Q.Gate.CURSOR.symbol) {
        throw new Error("Control must be connected to a target.");
      }
      // Validate that the registerIndices length matches the gate's expected qubit count
      const expectedLength = Math.log2(operation.gate.matrix.columns.length);
      if (operation.registerIndices.length < expectedLength) {
        throw new Error(
          `${operation.gate.name} gate must connect ${expectedLength} qubits.`
        );
      }
    }
    // If validations pass, call the original evaluate implementation
    origEvaluate(circuit);
  })(Q.Circuit.evaluate);

// Fix swap gate appearance in the transposed-table constructor so it's not treated as controlled
patchMethod(Q.Circuit, "fromTableTransposed", [
  [
    "circuit.operations[ operationsIndex ].isControlled = operation.gateSymbol != '*'",
    "circuit.operations[ operationsIndex ].isControlled = operation.gateSymbol != Q.Gate.SWAP.symbol",
  ],
]);

// Make row and column labels 0-indexed instead of 1-indexed in the Q.Circuit Editor UI
patchMethod(Q.Circuit, "Editor", [
  [
    "momentsymbolEl.innerText = momentIndex",
    "momentsymbolEl.innerText = momentIndex - 1",
  ],
  [
    "registersymbolEl.innerText = registerIndex",
    "registersymbolEl.innerText = registerIndex - 1",
  ],
]);

// Combine the "Control" and "Swap" buttons into one toggle button in the Circuit Editor toolbar
patchMethod(Q.Circuit, "Editor", [
  [
    /controlButton.classList.add\( (.*) \)/,
    "controlButton.classList.add( $1, 'Q-circuit-toggle-swap' )", // add extra class for swap toggle styling
  ],
  [
    /controlButton.setAttribute\( 'title', .* \)/,
    "controlButton.setAttribute( 'title', 'Create controlled or swap operation' )", // update tooltip
  ],
  [
    /controlButton\.innerText = .*/,
    "controlButton.innerText = 'C/S'", // change button text to "C/S"
  ],
  ["toolbarEl.appendChild( swapButton )", ""], // remove separate swapButton append
]);

// Adjust isValidControlCandidate so that it only enables the control/swap toggle if a valid gate symbol is selected
patchMethod(Q.Circuit.Editor, "isValidControlCandidate", [
  [
    "if( !registerIndicesString ) return status",
    "if( !registerIndicesString ) return status && Math.log2(Q.Gate.findBySymbol(operationEl.getAttribute('gate-symbol')).matrix.columns.length) === 1",
  ],
]);

// Only allow swap candidates when the gate-symbol is exactly Q.Gate.SWAP.symbol
patchMethod(Q.Circuit.Editor, "isValidSwapCandidate", [
  [
    "operationEl.getAttribute( 'gate-symbol' ) === Q.Gate.CURSOR.symbol",
    "operationEl.getAttribute( 'gate-symbol' ) === Q.Gate.SWAP.symbol",
  ],
]);

// In createSwap, enforce a sorted order of qubit indices so that swap operations are consistent
patchMethod(Q.Circuit.Editor, "createSwap", [
  [
    "//  Create the swap operation.",
    "registerIndices.sort()",
  ],
]);

// Override selection change behavior to disable the C/S button if neither a valid control nor swap candidate
Q.Circuit.Editor.onSelectionChanged = function (circuitEl) {
  const controlButtonEl = circuitEl.querySelector(".Q-circuit-toggle-control");
  controlButtonEl.toggleAttribute(
    "Q-disabled",
    !Q.Circuit.Editor.isValidControlCandidate(circuitEl) &&
      !Q.Circuit.Editor.isValidSwapCandidate(circuitEl)
  );
};

// Patch the palette creation so that custom gate.unicode symbols (if provided) appear instead of default text
patchMethod(Q.Circuit.Editor, "createPalette", [
  [
    "if( symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = symbol",
    "if( symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = gate.unicode ?? symbol",
  ],
]);

// Patch the "set" method in the editor UI so that:
//    a) custom gate.unicode glyphs appear instead of default gate.symbol
//    b) maintain square shape for swap gates while applying proper CSS classes
patchMethod(Q.Circuit.Editor, "set", [
  [
    "if( operation.gate.symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = operation.gate.symbol",
    "if( operation.gate.symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = operation.gate.unicode ?? operation.gate.symbol",
  ],
  [
    // Only mark controlled operations with 'Q-circuit-operation-target'; leave swap as square.
    "else operationEl.classList.add( 'Q-circuit-operation-target' )",
    "else if( operation.isControlled ) operationEl.classList.add( 'Q-circuit-operation-target' )",
  ],
]);

// Define custom gate constants with modified names, CSS identifiers, or unicode
Q.Gate.createConstants(
  "IDENTITY",
  new Q.Gate(
    Object.assign({}, Q.Gate.IDENTITY, {
      nameCss: undefined, // remove default styling class for IDENTITY
    })
  ),
  "CURSOR",
  new Q.Gate(
    Object.assign({}, Q.Gate.CURSOR, {
      name: "Control",
      nameCss: "control", // apply our custom "control" CSS class
    })
  ),
  "PAULI_X",
  new Q.Gate(
    Object.assign({}, Q.Gate.PAULI_X, {
      name: "Not",
      unicode: "⨁", // show ⨁ instead of plain "X"
    })
  ),
  "SWAP",
  new Q.Gate(
    Object.assign({}, Q.Gate.SWAP, {
      nameCss: undefined,
      unicode: "𓏵", // custom icon for SWAP
    })
  )
);

// Patch Q.Circuit.prototype.set$ to automatically compute the moment index
//     (time slot) if not provided, similar to Qiskit's behavior. Also, validate indices.
patchMethod(Q.Circuit.prototype, "set$", [
  [
    "function( gate, momentIndex, registerIndices ){",
    `function( gate, ...args ){
      let momentIndex, registerIndices;
      // If two args are passed and second is array, treat [momentIndex, registerIndices] as tuple
      if (args.length == 2 && args[1] instanceof Array) {
        [momentIndex, registerIndices] = args;
      } else {
        registerIndices = args;
      }
      // Validate individual register indices are within [1..bandwidth] and integral
      if (registerIndices.some(index => index > this.bandwidth || index < 1 || !Number.isInteger(index))) {
        throw new Error(\`Invalid register index: \${index}\`);
      }
      // Do not allow duplicate indices in the same gate invocation
      if (new Set(registerIndices).size != registerIndices.length) {
        throw new Error("Duplicate register indices are not allowed.");
      }
      // Auto-compute momentIndex if not provided: find earliest "time slot" with no overlap
      if (momentIndex == undefined) {
        momentIndex = 1;
        for (const operation of this.operations) {
          if (Math.min(...registerIndices) <= Math.max(...operation.registerIndices) && Math.min(...operation.registerIndices) <= Math.max(...registerIndices)) {
            // overlapping wires => bump momentIndex
            momentIndex = Math.max(momentIndex, operation.momentIndex + 1);
          }
        }
      }
      // Validate that momentIndex is an integer within [1..timewidth]
      if (momentIndex > this.timewidth || momentIndex < 1 || !Number.isInteger(momentIndex)) {
        throw new Error(\`Invalid moment index: \${momentIndex}\`);
      }
    `,
  ],
]);

// Define methods on Q.Circuit.prototype for each gate constant, to be used
// by students for setting gates in their circuits.
Object.entries(Q.Gate.constants).forEach(function (entry) {
  const gateConstantName = entry[0], // e.g., "PAULI_X"
    gate = entry[1],                 // the actual Q.Gate object
    offsetIndices = (args) =>
      args.map((arg) => {
        if (typeof arg === "number") {
          return arg + 1; // convert from 0-based to 1-based for Q.js
        }
        if (arg instanceof Array) {
          return offsetIndices(arg);
        }
        return arg;
      }),
    set$ = function (...args) {
      // Call the patched set$ method with gate and offset indices
      this.set$(gate, ...offsetIndices(args));
      return this;
    };
  // Attach multiple method names: NAME, name (lowercase), symbol, symbol lowercase
  Q.Circuit.prototype[gateConstantName] = set$;
  Q.Circuit.prototype[gateConstantName.toLowerCase()] = set$;
  Q.Circuit.prototype[gate.symbol] = set$;
  Q.Circuit.prototype[gate.symbol.toLowerCase()] = set$;
});

// MARK: - functions to set up the widget

/**
 * createCircuitEditor:
 *   Instantiates a Q.Circuit.Editor UI component inside a <div> wrapper,
 *   optionally making it editable (if "editable" is true). Also sets initial
 *   qubit input labels to either "|0⟩" or arbitrary Greek-letter states.
 *
 * circuit:         a Q.Circuit instance
 * editable:        boolean, whether students can modify the circuit
 * arbitraryInputs: boolean, if true, assign Greek letters |α⟩, |β⟩, ... to inputs; else use |0⟩
 *
 * Returns: the <div> element containing the rendered circuit editor.
 */
const createCircuitEditor = (
  circuit,
  editable = true,
  arbitraryInputs = true
) => {
  const editor = document.createElement("div");
  // Render the circuit into this <div>, giving it an HTML id="circuit"
  circuit.setName$("circuit").toDom(editor);

  // Remove any extraneous <p> tags automatically added by Q.js
  editor.querySelectorAll("p").forEach((p) => p.remove());
  // Lock or unlock the editor based on "editable"
  editor.classList.toggle("Q-circuit-locked", !editable);
  // Remove the lock icon or toolbar toggle depending on editability
  editor
    .querySelector(editable ? ".Q-circuit-toggle-lock" : ".Q-circuit-toolbar")
    .remove();

  // Assign initial input states to each qubit header
  const circuitInputs = editor.querySelectorAll(".Q-circuit-input");
  if (arbitraryInputs) {
    // Use Greek letters α, β, γ, ... for each qubit input label
    const greekAlphabet = "αβγδεζηθικλμνξοπρστυφχψω";
    circuitInputs.forEach((input, i) => {
      input.textContent = `|${greekAlphabet[i]}⟩`;
    });
  } else {
    // Default all inputs to |0⟩
    circuitInputs.forEach((input) => {
      input.textContent = "|0⟩";
    });
  }

  return editor;
};

/**
 * stateToText:
 *   Converts a Q.Matrix "state" object (column vector) to a human-readable
 *   superposition string, e.g., "(1/√2)|00⟩ + (1/√2)|11⟩".
 *
 * state:          a Q.Matrix representing column-vector of amplitudes
 * roundToDecimal: number of decimal places for floating output
 *
 * Returns: string representation of superposition (omitting zero amplitudes).
 */
const stateToText = (state, roundToDecimal) => {
  const bandwidth = Math.log2(state.rows.length); // number of qubits
  const superposition = state.rows.map(function (row, i) {
    return {
      amplitude: row[0],
      // Convert row index to binary string of length "bandwidth"
      state: "|" + parseInt(i, 10).toString(2).padStart(bandwidth, "0") + "⟩",
    };
  });
  let text = "";
  for (const { amplitude, state } of superposition) {
    let amplitudeText = amplitude.toText(roundToDecimal, false);
    if (amplitudeText == "0") {
      continue; // skip zero amplitudes
    }
    let containsSpace = amplitudeText.includes(" ");
    if (text != "") {
      // If already have a term, prefix with "+" or convert to negative
      let negAmplitudeText = amplitude
        .multiply(-1)
        .toText(roundToDecimal, false);
      if (!negAmplitudeText.includes("-")) {
        text += " - ";
        amplitudeText = negAmplitudeText;
      } else {
        text += " + ";
      }
    }
    // Format coefficient "*|state⟩" or just "|state⟩" if amplitude is ±1
    if (amplitudeText == "1") {
      text += state;
    } else if (amplitudeText == "-1") {
      text += `-${state}`;
    } else if (containsSpace) {
      text += `(${amplitudeText})${state}`;
    } else {
      text += `${amplitudeText}${state}`;
    }
  }
  return text;
};

/**
 * createGrader:
 *   Builds a "grader" UI component that compares a student's circuit to a goal.
 *   If instantFeedback=true, grading occurs on every change; otherwise, show
 *   a "Check work" button and mark grader dirty on edits.
 *
 * goalCircuit:          Q.Circuit representing the target circuit
 * studentCircuitEditor: the Q.Circuit.Editor instance for student input
 * gradingFunction:      (goalCircuit, studentCircuit) => [boolean, feedbackText]
 * instantFeedback:      boolean, if true run gradingFunction on every change
 *
 * Returns: a <div class="grader"> containing feedback (and possibly a button).
 */
const createGrader = (
  goalCircuit,
  studentCircuitEditor,
  gradingFunction,
  instantFeedback
) => {
  // Internal function to compare circuits and display feedback
  const checkWork = () => {
    grader.classList.remove("dirty"); // remove "needs-check" state
    goalCircuit.evaluate$(); // compute goalCircuit.outputState or other properties
    try {
      studentCircuitEditor.circuit.evaluate$(); // evaluate student circuit
    } catch (error) {
      // If evaluation errors, display error
      feedback.classList.add("wrong");
      feedback.textContent = `Error: ${error.message}`;
      return;
    }
    const [isCorrect, feedbackText] = gradingFunction(
      goalCircuit,
      studentCircuitEditor.circuit
    );
    feedback.classList.toggle("correct", isCorrect);
    feedback.classList.toggle("wrong", !isCorrect);
    feedback.textContent = feedbackText;

    if (isCorrect) {
      console.log("About to save score");
      SPLICE.saveScore(1);
      console.log("Score saved");
    }
  };

  const grader = document.createElement("div");
  grader.className = "grader";

  const feedback = document.createElement("div");
  feedback.textContent = "Feedback will appear here.";
  feedback.className = "feedback";
  grader.append(feedback);

  if (!instantFeedback) {
    // If not instant feedback, add a "Check work" button
    grader.classList.add("dirty");
    const button = document.createElement("button");
    button.textContent = "Check work";
    button.className = "check-work";
    button.addEventListener("click", checkWork);
    grader.append(button);
  }

  // Listen for any circuit change events triggered by the editor
  window.addEventListener("Q gui altered circuit", (event) => {
    if (
      event.detail.circuit == goalCircuit ||
      event.detail.circuit == studentCircuitEditor.circuit
    ) {
      if (instantFeedback) {
        checkWork();
      } else {
        grader.classList.add("dirty");
      }
    }
  });

  return grader;
};

const defaultGateSymbols = "HXYZPTS*";

/**
 * createPalette:
 *   Builds a custom gate palette <div> that only includes allowed gates.
 *   This works by taking Q.Circuit.Editor.createPalette's source, replacing
 *   the default gateSymbols string with our provided gateSymbols, then
 *   invoking that modified function in a new <div>.
 *
 * gateSymbols: string of characters identifying which gates to include
 *
 * Returns: <div class="Q-circuit-palette"> with the filtered gate buttons.
 */
const createPalette = (gateSymbols = defaultGateSymbols) => {
  // Convert the original createPalette function to a string
  const origCreatePalette = Q.Circuit.Editor.createPalette.toString();
  // Extract the original gateSymbols used in that function
  const origGateSymbols = origCreatePalette.match(/'([^']*)'\s*\.split/)[1];
  // Replace origGateSymbols with our custom gateSymbols in the source
  const modifiedCreatePalette = eval(
    `(${origCreatePalette.replace(origGateSymbols, gateSymbols)})`
  );
  const palette = document.createElement("div");
  palette.className = "Q-circuit-palette";
  modifiedCreatePalette(palette); // Build the actual buttons inside
  return palette;
};

/**
 * createCodeEditor:
 *   Inserts a code-input component (JavaScript editor) so students can type
 *   Qiskit-like code to manipulate a circuit. On every input, it attempts to
 *   parse the code, update the circuit editor, and adjust opacity to signal errors.
 *
 * circuitEditor: Q.Circuit.Editor instance whose circuit property is a Q.Circuit
 *
 * Returns: <code-input> element with event listeners for live parsing.
 */
const createCodeEditor = (circuitEditor) => {
  const codeEditor = document.createElement("code-input");
  // Register the syntax-highlighting template for code-input
  codeInput.registerTemplate(
    "syntax-highlighted",
    codeInput.templates.hljs(hljs, [])
  );
  codeEditor.setAttribute("language", "js");
  codeEditor.className = "widget-code";
  // Placeholder showing example Qiskit-like commands
  codeEditor.setAttribute(
    "placeholder",
    `// Write your circuit code here... for example:
circuit.x(0); // applies a NOT to qubit 0
circuit.swap(0, 1); // applies a SWAP to qubits 0 and 1
circuit.h(0); // applies an H to qubit 0
circuit.x(0, 1); // applies a CNOT to qubits 0 and 1`
  );
  codeEditor.addEventListener("input", () => {
    let opacity = 1;
    try {
      // Create a fresh copy of the student's circuit to parse code into
      const newCircuit = Q(
        circuitEditor.circuit.bandwidth,
        circuitEditor.circuit.timewidth
      );
      // Dynamically evaluate the user's code in a function scope
      new Function("circuit", codeEditor.value)(newCircuit);
      // Remove all existing gate DOM elements before redrawing
      circuitEditor
        .querySelectorAll(
          ".Q-circuit-operation, .Q-circuit-operation-link-container"
        )
        .forEach((operation) => {
          operation.remove();
        });
      // Redraw each operation onto the circuitEditor
      newCircuit.operations.forEach((operation) =>
        Q.Circuit.Editor.set(circuitEditor, operation)
      );
      circuitEditor.circuit = newCircuit;
      // Dispatch event so any graders or probability displays update
      window.dispatchEvent(
        new CustomEvent("Q gui altered circuit", {
          detail: { circuit: newCircuit },
        })
      );
    } catch (error) {
      // If parsing/execution fails, make the circuit board semi-transparent
      opacity = 0.5;
    }
    circuitEditor.querySelector(".Q-circuit-board-container").style.opacity =
      opacity;
  });
  return codeEditor;
};

/**
 * processCircuitInput:
 *   Normalizes a "circuit" parameter which may be either:
 *   - A string key referring to a predefined circuit from circuits.js
 *   - A Q.Circuit object or circuit data directly accepted by Q constructor
 *
 * After resolution, it ensures the circuit is evaluated before returning.
 */
const processCircuitInput = (circuit) => {
  if (typeof circuit === "string") {
    if (circuits.has(circuit)) {
      circuit = circuits.get(circuit); // Look up from circuits.js Map
    }
    circuit = Q(circuit); // Convert raw data to a Q.Circuit object
  }
  circuit.evaluate$(); // Pre-compute outputState for grading/visualization
  return circuit;
};

/**
 * finalizeWidget:
 *   Appends the completed widget <div> to document.body, then resizes the
 *   <iframe> (parent frame) so it wraps exactly around the widget's content.
 *
 * widget: <div> containing all interactive elements, to be added to body
 */
const finalizeWidget = (widget) => {
  document.body.append(widget);
  // Remove any fixed width/height attributes on the <iframe> wrapper
  window.frameElement.removeAttribute("width");
  window.frameElement.removeAttribute("height");
  // Set iframe height to match document height so there is no scroll inside
  window.frameElement.style.height = `${document.documentElement.scrollHeight}px`;
  window.frameElement.style.width = "100%";
};

/**
 * createStudentEditor:
 *   Builds and appends the student's circuit editor (either a graphical palette
 *   or a code editor) to the widget. Returns the Q.Circuit.Editor instance.
 *
 * widget:          <div> container for the entire widget
 * circuit:         Q.Circuit instance (goal or initial circuit)
 * keepGates:       boolean; if false, start student circuit as blank; if true, copy goal gates
 * arbitraryInputs: boolean for initial qubit labels
 * allowedGates:    string of gate symbols for filtering palette
 * code:            boolean; if true, use code editor instead of visual palette
 */
const createStudentEditor = ({
  widget,
  circuit,
  keepGates = false,
  arbitraryInputs,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  // If keepGates=false, create an empty circuit of same dimensions; else clone the original circuit
  const circuitEditor = createCircuitEditor(
    keepGates ? circuit : Q(circuit.bandwidth, circuit.timewidth),
    !code,
    arbitraryInputs
  );
  // Append either code editor or palette for gate entry
  widget.append(
    code ? createCodeEditor(circuitEditor) : createPalette(allowedGates)
  );
  widget.append(circuitEditor);
  return circuitEditor;
};

// MARK: - widget creation functions

/**
 * identicalCircuitWidget:
 *   Asks students to recreate a given circuit exactly. Displays:
 *   1) A read-only "goal" circuit at top
 *   2) An editable student circuit below
 *   3) A grader that checks if the non-empty columns match exactly
 *
 * options: {
 *   circuit: string or Q.Circuit (target circuit),
 *   instantFeedback: boolean,
 *   allowedGates: string for palette,
 *   code: boolean for code editor
 * }
 */
const identicalCircuitWidget = ({
  circuit,
  instantFeedback = false,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit); // ensure evaluated circuit
  const arbitraryInputs = true; // use Greek letters for input state labels

  const widget = document.createElement("div");
  widget.className = "widget";

  // "Given the following circuit..." instructions
  const topInstructions = document.createElement("div");
  topInstructions.className = "instructions";
  topInstructions.textContent = "Given the following circuit...";

  // Render the goalCircuitEditor as read-only
  const goalCircuitEditor = createCircuitEditor(
    circuit,
    false,
    arbitraryInputs
  );

  // "Create the exact same circuit below:" instructions
  const middleInstructions = document.createElement("div");
  middleInstructions.className = "instructions";
  middleInstructions.textContent = "...create the exact same circuit below:";

  widget.append(topInstructions, goalCircuitEditor, middleInstructions);

  // Build the student editor (initially blank circuit)
  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    arbitraryInputs,
    allowedGates,
    code,
  });

  // Helper to extract only non-empty columns (ignore identity columns)
  const getNonEmptyColumns = (circuit) => {
    const rows = circuit
      .toText()
      .trim()
      .split("\n")
      .map((line) => line.split("-"));
    const columns = [];
    for (let i = 0; i < rows[0].length; i++) {
      const column = rows.map((row) => row[i]);
      if (column.some((gate) => gate != "I")) {
        columns.push(column);
      }
    }
    return columns.map((column) => column.join("-")).join("\n");
  };

  // Create grader that compares non-empty-column text of goal vs student
  const grader = createGrader(
    circuit,
    studentCircuitEditor,
    (goalCircuit, studentCircuit) =>
      getNonEmptyColumns(goalCircuit) == getNonEmptyColumns(studentCircuit)
        ? [true, "Great job! The circuits look identical."]
        : [false, "The circuits look different. Keep at it!"],
    instantFeedback
  );
  widget.append(grader);

  finalizeWidget(widget);
};

/**
 * equivalentCircuitWidget:
 *   Asks students to build a circuit that's functionally equivalent to
 *   the goal but uses fewer gates. Grading logic checks matrix equality and
 *   gate-count reduction.
 *
 * options: same shape as identicalCircuitWidget
 */
const equivalentCircuitWidget = ({
  circuit,
  instantFeedback = false,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = true;

  const widget = document.createElement("div");
  widget.className = "widget";

  const topInstructions = document.createElement("div");
  topInstructions.className = "instructions";
  topInstructions.textContent = "Given the following circuit...";

  const goalCircuitEditor = createCircuitEditor(
    circuit,
    false,
    arbitraryInputs
  );

  const middleInstructions = document.createElement("div");
  middleInstructions.className = "instructions";
  middleInstructions.textContent =
    "...create an equivalent circuit using fewer gates:";

  widget.append(topInstructions, goalCircuitEditor, middleInstructions);

  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    arbitraryInputs,
    allowedGates,
    code,
  });

  const grader = createGrader(
    circuit,
    studentCircuitEditor,
    (goalCircuit, studentCircuit) =>
      // Check matrix equivalence first
      goalCircuit.matrix.isEqualTo(studentCircuit.matrix)
        ? studentCircuit.operations.length < goalCircuit.operations.length
          ? [
              true,
              "Great job! You created an equivalent circuit with fewer gates.",
            ]
          : [false, "The circuits are equivalent, but you used too many gates."]
        : [false, "The circuits are not equivalent. Keep at it!"],
    instantFeedback
  );
  widget.append(grader);

  finalizeWidget(widget);
};

/**
 * matchOutputWidget:
 *   Given a goal circuit and its input state, ask students to reproduce the
 *   same output state with fewer gates. The goalCircuitEditor is read-only,
 *   and arbitraryInputs=false means the student's inputs are fixed to |0⟩.
 *
 * options: same as above
 */
const matchOutputWidget = ({
  circuit,
  instantFeedback = false,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = false; // inputs fixed to |0⟩ for goal and student

  const widget = document.createElement("div");
  widget.className = "widget";

  const goalCircuitEditor = createCircuitEditor(
    circuit,
    false,
    arbitraryInputs
  );

  const topInstructions = document.createElement("div");
  topInstructions.className = "instructions";
  topInstructions.textContent = `Given the following circuit and the input state ${stateToText(
    goalCircuitEditor.circuit.inputState
  )}...`;

  const middleInstructions = document.createElement("div");
  middleInstructions.className = "instructions";
  middleInstructions.textContent =
    "...produce the same output state using fewer gates:";

  widget.append(topInstructions, goalCircuitEditor, middleInstructions);

  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    arbitraryInputs,
    allowedGates,
    code,
  });

  const grader = createGrader(
    circuit,
    studentCircuitEditor,
    (goalCircuit, studentCircuit) =>
      goalCircuit.outputState.isEqualTo(studentCircuit.outputState)
        ? studentCircuit.operations.length < goalCircuit.operations.length
          ? [true, "Great job! The output states match."]
          : [false, "The output states match, but you used too many gates."]
        : [false, "The output states do not match. Keep at it!"],
    instantFeedback
  );
  widget.append(grader);

  finalizeWidget(widget);
};

/**
 * specificOutputWidget:
 *   Given a fixed input state (from circuit.inputState) and a desired target
 *   output state (circuit.outputState), ask students to build any circuit
 *   achieving that transformation. There is no goal circuit displayed.
 *
 * options: same as above
 */
const specificOutputWidget = ({
  circuit,
  instantFeedback = false,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = false;

  const widget = document.createElement("div");
  widget.className = "widget";

  // Show instructions containing both input and target states
  const instructions = document.createElement("div");
  instructions.className = "instructions";
  instructions.textContent = `Given the input state ${stateToText(
    circuit.inputState
  )}, create a circuit that produces the output state ${stateToText(
    circuit.outputState
  )}.`;

  widget.append(instructions);

  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    arbitraryInputs,
    allowedGates,
    code,
  });

  const grader = createGrader(
    circuit,
    studentCircuitEditor,
    (goalCircuit, studentCircuit) =>
      goalCircuit.outputState.isEqualTo(studentCircuit.outputState)
        ? [true, "Great job! Your circuit produces the correct output state."]
        : [
            false,
            `Your circuit produces the output state ${stateToText(
              studentCircuit.outputState
            )}. Keep at it!`,
          ],
    instantFeedback
  );
  widget.append(grader);

  finalizeWidget(widget);
};

/**
 * visualizeProbabilitiesWidget:
 *   Shows a circuit editor with keepGates=true so the student sees the
 *   initial complete circuit. Below it is a <samp> that displays the probability
 *   distribution (studentCircuit.report$()). On every change, recalculate
 *   and update the probabilities or show an error message.
 *
 * options: {
 *   circuit: string or Q.Circuit,
 *   allowedGates: string for palette,
 *   code: boolean for code editor
 * }
 */
const visualizeProbabilitiesWidget = ({
  circuit,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = false;

  const widget = document.createElement("div");
  widget.className = "widget";

  // Build the student editor pre-populated with all goal gates
  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    keepGates: true,
    arbitraryInputs,
    allowedGates,
    code,
  });

  // Create a <pre><samp> area to display probability output
  const pre = document.createElement("pre");
  const probDisplay = document.createElement("samp");
  probDisplay.innerText = studentCircuitEditor.circuit.report$();
  probDisplay.className = "prob-display";
  pre.append(probDisplay);
  widget.append(pre);

  // On any change to the student circuit, re-evaluate and update probabilities
  window.addEventListener("Q gui altered circuit", (event) => {
    if (event.detail.circuit == studentCircuitEditor.circuit) {
      try {
        studentCircuitEditor.circuit.evaluate$();
      } catch (error) {
        // If evaluation fails, print error and preserve line count
        probDisplay.innerText =
          `\nError: ${error.message}` +
          "\n".repeat(probDisplay.innerText.split("\n").length - 2);
        return;
      }
      probDisplay.innerText = studentCircuitEditor.circuit.report$();
    }
  });

  finalizeWidget(widget);
};
