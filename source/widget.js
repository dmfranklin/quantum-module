window.parent.Q = Q;

// MARK: - patch Q.js to fix bugs and add features

const patchMethod = (object, methodName, replacements) => {
  const newMethod = eval(
    `(${replacements.reduce(
      (source, [regex, replacement]) => source.replace(regex, replacement),
      object[methodName].toString()
    )})`
  );
  Object.defineProperties(
    newMethod,
    Object.getOwnPropertyDescriptors(object[methodName])
  );
  object[methodName] = newMethod;
};

patchMethod(Q.Matrix, "multiplyTensor", [
  [
    // fix bug in tensor product implementation so it works for matrices with different dimensions
    /(?<=matrix0[XY] = Math\.floor\( [xy] \/ matrix)0(?=\.(columns|rows).length \))/g,
    "1",
  ],
]);

patchMethod(Q.Circuit, "evaluate", [
  // fix bug causing initial qubit state to be ignored
  [
    /const state = .*\s*state.write\$\( 0, 0, 1 \)/,
    `
    const state = circuit.inputState = circuit.qubits.reduce( function( state, qubit ){
			return state.multiplyTensor(new Q.Matrix( ...qubit.rows ))
		}, new Q.Matrix( [ 1 ] ))
    `,
  ],

  // fix bug causing SWAP gates to not work
  [
    "for( let j = 0; j < operation.registerIndices.length - 1; j ++ )",
    "for( let j = operation.registerIndices.length - Math.log2( U.getWidth() ); j > 0; j -- )",
  ],

  // store entire circuit matrix instead of just the transformed qubit state
  [
    "}, state )",
    "}, Q.Matrix.createIdentity( Math.pow( 2, circuit.bandwidth )))",
  ],
  [
    /(?<=const outcomes = )matrix(?=\.rows\.reduce)/,
    "(circuit.outputState = matrix.multiply( state ))",
  ],
]);
Q.Circuit.evaluate = ((origEvaluate) =>
  function (circuit) {
    for (const operation of circuit.operations) {
      if (operation.gate.symbol == Q.Gate.CURSOR.symbol) {
        throw new Error("Control must be connected to a target.");
      }
      const expectedLength = Math.log2(operation.gate.matrix.columns.length);
      if (operation.registerIndices.length < expectedLength) {
        throw new Error(
          `${operation.gate.name} gate must connect ${expectedLength} qubits.`
        );
      }
    }
    origEvaluate(circuit);
  })(Q.Circuit.evaluate);

// fix swap gate appearance
patchMethod(Q.Circuit, "fromTableTransposed", [
  [
    "circuit.operations[ operationsIndex ].isControlled = operation.gateSymbol != '*'",
    "circuit.operations[ operationsIndex ].isControlled = operation.gateSymbol != Q.Gate.SWAP.symbol",
  ],
]);

// combine control and swap buttons into one button
patchMethod(Q.Circuit, "Editor", [
  [
    /controlButton.classList.add\( (.*) \)/,
    "controlButton.classList.add( $1, 'Q-circuit-toggle-swap' )",
  ],
  [
    /controlButton.setAttribute\( 'title', .* \)/,
    "controlButton.setAttribute( 'title', 'Create controlled or swap operation' )",
  ],
  [/controlButton\.innerText = .*/, "controlButton.innerText = 'C/S'"],
  ["toolbarEl.appendChild( swapButton )", ""],
]);
patchMethod(Q.Circuit.Editor, "isValidControlCandidate", [
  [
    "if( !registerIndicesString ) return status",
    "if( !registerIndicesString ) return status && Math.log2(Q.Gate.findBySymbol(operationEl.getAttribute('gate-symbol')).matrix.columns.length) === 1",
  ],
]);
patchMethod(Q.Circuit.Editor, "isValidSwapCandidate", [
  [
    "operationEl.getAttribute( 'gate-symbol' ) === Q.Gate.CURSOR.symbol",
    "operationEl.getAttribute( 'gate-symbol' ) === Q.Gate.SWAP.symbol",
  ],
]);
patchMethod(Q.Circuit.Editor, "createSwap", [
  // sort swap qubit indices to enforce consistent ordering
  ["//  Create the swap operation.", "registerIndices.sort()"],
]);
Q.Circuit.Editor.onSelectionChanged = function (circuitEl) {
  const controlButtonEl = circuitEl.querySelector(".Q-circuit-toggle-control");
  controlButtonEl.toggleAttribute(
    "Q-disabled",
    !Q.Circuit.Editor.isValidControlCandidate(circuitEl) &&
      !Q.Circuit.Editor.isValidSwapCandidate(circuitEl)
  );
};

patchMethod(Q.Circuit.Editor, "createPalette", [
  // show custom gate symbols in the palette
  [
    "if( symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = symbol",
    "if( symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = gate.unicode ?? symbol",
  ],
]);

patchMethod(Q.Circuit.Editor, "set", [
  // show custom gate symbols in the circuit editor
  [
    "if( operation.gate.symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = operation.gate.symbol",
    "if( operation.gate.symbol !== Q.Gate.CURSOR.symbol ) tileEl.innerText = operation.gate.unicode ?? operation.gate.symbol",
  ],
  // keep swap gate square-shaped
  [
    "else operationEl.classList.add( 'Q-circuit-operation-target' )",
    "else if( operation.isControlled ) operationEl.classList.add( 'Q-circuit-operation-target' )",
  ],
]);

// set custom gate appearances
Q.Gate.createConstants(
  "IDENTITY",
  new Q.Gate(
    Object.assign({}, Q.Gate.IDENTITY, {
      nameCss: undefined,
    })
  ),
  "CURSOR",
  new Q.Gate(
    Object.assign({}, Q.Gate.CURSOR, {
      name: "Control",
      nameCss: "control",
    })
  ),
  "PAULI_X",
  new Q.Gate(
    Object.assign({}, Q.Gate.PAULI_X, {
      name: "Not",
      unicode: "⨁",
    })
  ),
  "SWAP",
  new Q.Gate(
    Object.assign({}, Q.Gate.SWAP, {
      nameCss: undefined,
      unicode: "𓏵",
    })
  )
);

// compute moment index automatically, mirroring the behavior of Qiskit
patchMethod(Q.Circuit.prototype, "set$", [
  [
    "function( gate, momentIndex, registerIndices ){",
    `function( gate, ...registerIndices ){
      if (registerIndices.some(index => index > this.bandwidth || index < 1 || !Number.isInteger(index))) {
        throw new Error(\`Invalid register index: \${index}\`);
      }
      if (new Set(registerIndices).size != registerIndices.length) {
        throw new Error("Duplicate register indices are not allowed.");
      }
      let momentIndex = 1;
      for (const operation of this.operations) {
        if (Math.min(...registerIndices) <= Math.max(...operation.registerIndices) && Math.min(...operation.registerIndices) <= Math.max(...registerIndices)) {
          // avoid overlap with existing operation
          momentIndex = Math.max(momentIndex, operation.momentIndex + 1);
        }
      }
      if (momentIndex > this.timewidth || momentIndex < 1 || !Number.isInteger(momentIndex)) {
        throw new Error(\`Invalid moment index: \${momentIndex}\`);
      }
    `,
  ],
]);
Object.entries(Q.Gate.constants).forEach(function (entry) {
  const gateConstantName = entry[0],
    gate = entry[1],
    set$ = function (...args) {
      this.set$(gate, ...args);
      return this;
    };
  Q.Circuit.prototype[gateConstantName] = set$;
  Q.Circuit.prototype[gate.symbol] = set$;
  Q.Circuit.prototype[gate.symbol.toLowerCase()] = set$;
});

// MARK: - functions to set up the widget

const createCircuitEditor = (
  circuit,
  editable = true,
  arbitraryInputs = true
) => {
  const editor = document.createElement("div");
  circuit.setName$("circuit").toDom(editor);

  editor.querySelectorAll("p").forEach((p) => p.remove());
  editor.classList.toggle("Q-circuit-locked", !editable);
  editor
    .querySelector(editable ? ".Q-circuit-toggle-lock" : ".Q-circuit-toolbar")
    .remove();

  if (arbitraryInputs) {
    const circuitInputs = editor.querySelectorAll(".Q-circuit-input");
    const greekAlphabet = "αβγδεζηθικλμνξοπρστυφχψω";
    circuitInputs.forEach((input, i) => {
      input.textContent = `|${greekAlphabet[i]}⟩`;
    });
  }

  return editor;
};

const stateToText = (state, roundToDecimal) => {
  const bandwidth = Math.log2(state.rows.length);
  const superposition = state.rows.map(function (row, i) {
    return {
      amplitude: row[0],
      state: "|" + parseInt(i, 10).toString(2).padStart(bandwidth, "0") + "⟩",
    };
  });
  let text = "";
  for (const { amplitude, state } of superposition) {
    let amplitudeText = amplitude.toText(roundToDecimal, false);
    if (amplitudeText == "0") {
      continue;
    }
    let containsSpace = amplitudeText.includes(" ");
    if (text != "") {
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

const createGrader = (
  goalCircuit,
  studentCircuitEditor,
  gradingFunction,
  instantFeedback
) => {
  const checkWork = () => {
    grader.classList.remove("dirty");
    goalCircuit.evaluate$();
    try {
      studentCircuitEditor.circuit.evaluate$();
    } catch (error) {
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
  };

  const grader = document.createElement("div");
  grader.className = "grader";

  const feedback = document.createElement("div");
  feedback.textContent = "Feedback will appear here.";
  feedback.className = "feedback";
  grader.append(feedback);

  if (!instantFeedback) {
    grader.classList.add("dirty");
    const button = document.createElement("button");
    button.textContent = "Check work";
    button.className = "check-work";
    button.addEventListener("click", checkWork);
    grader.append(button);
  }

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
const createPalette = (gateSymbols = defaultGateSymbols) => {
  const origCreatePalette = Q.Circuit.Editor.createPalette.toString();
  const origGateSymbols = origCreatePalette.match(/'([^']*)'\s*\.split/)[1];
  const modifiedCreatePalette = eval(
    `(${origCreatePalette.replace(origGateSymbols, gateSymbols)})`
  );
  const palette = document.createElement("div");
  palette.className = "Q-circuit-palette";
  modifiedCreatePalette(palette);
  return palette;
};

const createCodeEditor = (circuitEditor) => {
  const codeEditor = document.createElement("code-input");
  codeInput.registerTemplate(
    "syntax-highlighted",
    codeInput.templates.hljs(hljs, [])
  );
  codeEditor.setAttribute("language", "js");
  codeEditor.className = "widget-code";
  codeEditor.setAttribute(
    "placeholder",
    `// Write your circuit code here... for example:
circuit.h(1); // applies an H to qubit 1
circuit.x(2); // applies an NOT to qubit 2
circuit.x(1, 2); // applies a CNOT to qubits 1 and 2`
  );
  codeEditor.addEventListener("input", () => {
    try {
      const newCircuit = Q(
        circuitEditor.circuit.bandwidth,
        circuitEditor.circuit.timewidth
      );
      new Function("circuit", codeEditor.value)(newCircuit);
      const container = new Q.Circuit.Editor(
        newCircuit
      ).domElement.querySelector(".Q-circuit-board-container");
      circuitEditor
        .querySelector(".Q-circuit-board-container")
        .replaceWith(container);
      circuitEditor.circuit = newCircuit;
      window.dispatchEvent(
        new CustomEvent("Q gui altered circuit", {
          detail: { circuit: newCircuit },
        })
      );
    } catch (error) {
      circuitEditor.querySelector(
        ".Q-circuit-board-container"
      ).style.opacity = 0.5;
    }
  });
  return codeEditor;
};

const processCircuitInput = (circuit) => {
  if (typeof circuit === "string") {
    if (circuits.has(circuit)) {
      circuit = circuits.get(circuit);
    }
    circuit = Q(circuit);
  }
  circuit.evaluate$();
  return circuit;
};

const finalizeWidget = (widget, studentCircuitEditor) => {
  document.body.append(widget);
  window.frameElement.removeAttribute("width");
  window.frameElement.removeAttribute("height");
  window.frameElement.style.height = `${document.documentElement.scrollHeight}px`;
  window.frameElement.style.width = "100%";
};

const createStudentEditor = ({
  widget,
  circuit,
  keepGates = false,
  arbitraryInputs,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  const circuitEditor = createCircuitEditor(
    keepGates ? circuit : Q(circuit.bandwidth, circuit.timewidth),
    !code,
    arbitraryInputs
  );
  widget.append(
    code ? createCodeEditor(circuitEditor) : createPalette(allowedGates)
  );
  widget.append(circuitEditor);
  return circuitEditor;
};

// MARK: - widget creation functions

const identicalCircuitWidget = ({
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
  middleInstructions.textContent = "...create the exact same circuit below:";

  widget.append(topInstructions, goalCircuitEditor, middleInstructions);

  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    arbitraryInputs,
    allowedGates,
    code,
  });

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

  finalizeWidget(widget, studentCircuitEditor);
};

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

  finalizeWidget(widget, studentCircuitEditor);
};

const matchOutputWidget = ({
  circuit,
  instantFeedback = false,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = false;

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

  finalizeWidget(widget, studentCircuitEditor);
};

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

  finalizeWidget(widget, studentCircuitEditor);
};

const visualizeProbabilitiesWidget = ({
  circuit,
  allowedGates = defaultGateSymbols,
  code = false,
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = false;

  const widget = document.createElement("div");
  widget.className = "widget";

  const studentCircuitEditor = createStudentEditor({
    widget,
    circuit,
    keepGates: true,
    arbitraryInputs,
    allowedGates,
    code,
  });

  const pre = document.createElement("pre");
  const probDisplay = document.createElement("samp");
  probDisplay.innerText = studentCircuitEditor.circuit.report$();
  probDisplay.className = "prob-display";
  pre.append(probDisplay);
  widget.append(pre);

  window.addEventListener("Q gui altered circuit", (event) => {
    if (event.detail.circuit == studentCircuitEditor.circuit) {
      try {
        studentCircuitEditor.circuit.evaluate$();
      } catch (error) {
        probDisplay.innerText =
          `\nError: ${error.message}` +
          "\n".repeat(probDisplay.innerText.split("\n").length - 2);
        return;
      }
      probDisplay.innerText = studentCircuitEditor.circuit.report$();
    }
  });

  finalizeWidget(widget, studentCircuitEditor);
};
