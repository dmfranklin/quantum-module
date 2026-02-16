# Introduction to Quantum Computing and Qiskit

**Introduction to Quantum Computing and Qiskit** is a 2-week textbook for high school computer science students for learning the basics of quantum computing. Students will work through a series of interactive lessons that will teach them how to program in Qiskit, a popular language for building quantum circuits. The textbook itself is written in PreTeXt and the interactive widgets embedded within its lessons are written in JavaScript. The widgets integrate the Q.js quantum circuit editor, allowing students to build and analyze quantum circuits interactively. The textbook is designed to work in the context of the Runestone learning environment.

## Building and Viewing the Module

To build and view the textbook locally, follow these steps:

1. Clone or download the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/dmfranklin/quantum-module.git
   cd quantum-module
   ```

2. Create a Python virtual environment:

   ```bash
   python3 -m venv .venv
   ```

3. Activate it:
   1. On macOS/Linux/WSL:

      ```bash
      source .venv/bin/activate
      ```

   2. On Windows PowerShell:

      ```pwsh
      & .venv/Scripts/Activate.ps1
      ```

4. Install PreTeXt:

   ```bash
   pip install pretext
   ```

5. Build the textbook for the web:

   ```bash
   pretext build web
   ```

6. View the textbook in a browser:
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
- Add a link to the new lesson in the corresponding chapter (e.g. `chapter2.ptx`) by including:

  ```xml
  <xi:include href="lesson2.ptx" />
  ```

After making changes, rebuild the textbook using `pretext build web` and reload the page in your browser to see the updated content.

Alternatively, you may use a tool like [`watchexec`](https://github.com/watchexec/watchexec?tab=readme-ov-file#install) to automatically rebuild the textbook as you make changes. This way, you'll only need to refresh the page in your browser to see the updated content. `watchexec` should be available on your platform's package manager (e.g. Homebrew). After installing it, run the following command in the project directory to watch for changes in the `source` directory and rebuild the modulle automatically:

```bash
watchexec -w source -- pretext build web
```

## Integrating Interactive Widgets

The module supports embedding interactive quantum circuit builders. This can be used in different types of exercises, allowing students to construct, modify, and analyze quantum circuits. [Click here](./widget) for more details.
