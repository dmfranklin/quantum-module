window.parent.Q = Q;

// MARK: - patch Q.js to fix bugs and add features

const patchMethod = (object, methodName, replacements) => {
  object[methodName] = eval(
    `(${replacements.reduce(
      (source, [regex, replacement]) => source.replace(regex, replacement),
      object[methodName].toString()
    )})`
  );
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
  studentCircuit,
  gradingFunction,
  instantFeedback
) => {
  const checkWork = () => {
    grader.classList.remove("dirty");
    goalCircuit.evaluate$();
    studentCircuit.evaluate$();
    const [isCorrect, feedbackText] = gradingFunction(
      goalCircuit,
      studentCircuit
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
      event.detail.circuit == studentCircuit
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

const defaultGateSymbols = "HXYZPT*";
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

const processCircuitInput = (circuit) => {
  if (typeof circuit === "string") {
    if (circuitDiagrams.has(circuit)) {
      circuit = circuitDiagrams.get(circuit);
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
  const widgetWidth = studentCircuitEditor.querySelector(
    ".Q-circuit-board-container"
  ).scrollWidth;
  window.frameElement.style.width = `calc(min(100%, ${widgetWidth}px)`;
};

const createStudentEditor = (circuit, arbitraryInputs, useOriginal = false) => {
  return createCircuitEditor(
    useOriginal ? circuit : Q(circuit.bandwidth, circuit.timewidth),
    true,
    arbitraryInputs
  );
};

// MARK: - widget creation functions

const identicalCircuitWidget = ({
  circuit,
  instantFeedback = false,
  allowedGates = defaultGateSymbols,
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

  const palette = createPalette(allowedGates);
  const studentCircuitEditor = createStudentEditor(circuit, arbitraryInputs);
  widget.append(palette, studentCircuitEditor);

  const grader = createGrader(
    circuit,
    studentCircuitEditor.circuit,
    (goalCircuit, studentCircuit) =>
      goalCircuit.toText() === studentCircuit.toText()
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

  const palette = createPalette(allowedGates);
  const studentCircuitEditor = createStudentEditor(circuit, arbitraryInputs);
  widget.append(palette, studentCircuitEditor);

  const grader = createGrader(
    circuit,
    studentCircuitEditor.circuit,
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

  const palette = createPalette(allowedGates);
  const studentCircuitEditor = createStudentEditor(circuit, arbitraryInputs);
  widget.append(palette, studentCircuitEditor);

  const grader = createGrader(
    circuit,
    studentCircuitEditor.circuit,
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

  const palette = createPalette(allowedGates);
  const studentCircuitEditor = createStudentEditor(circuit, arbitraryInputs);
  widget.append(palette, studentCircuitEditor);

  const grader = createGrader(
    circuit,
    studentCircuitEditor.circuit,
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
}) => {
  circuit = processCircuitInput(circuit);
  const arbitraryInputs = false;

  const widget = document.createElement("div");
  widget.className = "widget";

  const palette = createPalette(allowedGates);
  const studentCircuitEditor = createStudentEditor(
    circuit,
    arbitraryInputs,
    true
  );
  widget.append(palette, studentCircuitEditor);

  const pre = document.createElement("pre");
  const probDisplay = document.createElement("samp");
  probDisplay.innerText = studentCircuitEditor.circuit.report$();
  probDisplay.className = "prob-display";
  pre.append(probDisplay);
  widget.append(pre);

  window.addEventListener("Q gui altered circuit", (event) => {
    if (event.detail.circuit == studentCircuitEditor.circuit) {
      studentCircuitEditor.circuit.evaluate$();
      probDisplay.innerText = studentCircuitEditor.circuit.report$();
    }
  });

  finalizeWidget(widget, studentCircuitEditor);
};

// MARK: - circuit texts

const circuitDiagrams = new Map([
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
    "Phi+",
    `
      H X#0 I I I I
      I X#1 I I I I
    `,
  ],
]);
