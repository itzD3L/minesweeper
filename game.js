const boardElement = document.getElementById("board");
const difficultySelect = document.getElementById("difficulty");
const newGameButton = document.getElementById("new-game");
const faceButton = document.getElementById("face-button");
const mineCountElement = document.getElementById("mine-count");
const timerElement = document.getElementById("timer");
const statusElement = document.getElementById("status");
const revealModeButton = document.getElementById("reveal-mode");
const flagModeButton = document.getElementById("flag-mode");

const difficultyMap = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 24, mines: 99 },
};

const cellSymbols = {
  hidden: "",
  flag: "F",
  mine: "*",
};

let state = null;

function createGame(difficultyKey) {
  const config = difficultyMap[difficultyKey];
  const board = [];

  stopTimer();

  for (let row = 0; row < config.rows; row += 1) {
    const currentRow = [];
    for (let col = 0; col < config.cols; col += 1) {
      currentRow.push({
        row,
        col,
        mine: false,
        revealed: false,
        flagged: false,
        adjacent: 0,
        exploded: false,
      });
    }
    board.push(currentRow);
  }

  state = {
    ...config,
    board,
    difficultyKey,
    minesPlaced: false,
    gameOver: false,
    win: false,
    revealedSafeCells: 0,
    flagsPlaced: 0,
    timer: 0,
    timerId: null,
    inputMode: "reveal",
  };

  boardElement.style.setProperty("--cols", String(config.cols));
  setInputMode("reveal");
  render();
  updateHud();
  setStatus("Clear every safe tile.", "");
}

function placeMines(safeRow, safeCol) {
  const protectedCells = new Set();

  for (let row = safeRow - 1; row <= safeRow + 1; row += 1) {
    for (let col = safeCol - 1; col <= safeCol + 1; col += 1) {
      if (isInsideBoard(row, col)) {
        protectedCells.add(`${row}:${col}`);
      }
    }
  }

  let placed = 0;
  while (placed < state.mines) {
    const row = Math.floor(Math.random() * state.rows);
    const col = Math.floor(Math.random() * state.cols);
    const cell = state.board[row][col];
    const key = `${row}:${col}`;

    if (cell.mine || protectedCells.has(key)) {
      continue;
    }

    cell.mine = true;
    placed += 1;
  }

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      state.board[row][col].adjacent = countAdjacentMines(row, col);
    }
  }

  state.minesPlaced = true;
}

function countAdjacentMines(row, col) {
  let count = 0;

  for (let nextRow = row - 1; nextRow <= row + 1; nextRow += 1) {
    for (let nextCol = col - 1; nextCol <= col + 1; nextCol += 1) {
      if (nextRow === row && nextCol === col) {
        continue;
      }

      if (isInsideBoard(nextRow, nextCol) && state.board[nextRow][nextCol].mine) {
        count += 1;
      }
    }
  }

  return count;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < state.rows && col >= 0 && col < state.cols;
}

function startTimer() {
  if (state.timerId || state.gameOver) {
    return;
  }

  state.timerId = window.setInterval(() => {
    state.timer += 1;
    timerElement.textContent = String(state.timer);
  }, 1000);
}

function stopTimer() {
  if (!state || !state.timerId) {
    return;
  }

  window.clearInterval(state.timerId);
  state.timerId = null;
}

function revealCell(row, col) {
  const cell = state.board[row][col];

  if (state.gameOver || cell.revealed || cell.flagged) {
    return;
  }

  if (!state.minesPlaced) {
    placeMines(row, col);
    startTimer();
  }

  cell.revealed = true;

  if (cell.mine) {
    loseGame(cell);
    return;
  }

  state.revealedSafeCells += 1;

  if (cell.adjacent === 0) {
    floodReveal(row, col);
  }

  checkForWin();
  render();
  updateHud();
}

function floodReveal(startRow, startCol) {
  const stack = [[startRow, startCol]];

  while (stack.length > 0) {
    const [row, col] = stack.pop();

    for (let nextRow = row - 1; nextRow <= row + 1; nextRow += 1) {
      for (let nextCol = col - 1; nextCol <= col + 1; nextCol += 1) {
        if (!isInsideBoard(nextRow, nextCol)) {
          continue;
        }

        const cell = state.board[nextRow][nextCol];
        if (cell.revealed || cell.flagged || cell.mine) {
          continue;
        }

        cell.revealed = true;
        state.revealedSafeCells += 1;

        if (cell.adjacent === 0) {
          stack.push([nextRow, nextCol]);
        }
      }
    }
  }
}

function toggleFlag(row, col) {
  const cell = state.board[row][col];

  if (state.gameOver || cell.revealed) {
    return;
  }

  cell.flagged = !cell.flagged;
  state.flagsPlaced += cell.flagged ? 1 : -1;

  render();
  updateHud();
}

function loseGame(triggeredCell) {
  state.gameOver = true;
  state.win = false;
  stopTimer();

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      if (cell.mine) {
        cell.revealed = true;
      }
    }
  }

  triggeredCell.exploded = true;
  setStatus("Mine hit. Reset and try again.", "lose");
  render();
  updateHud();
}

function checkForWin() {
  const safeCells = state.rows * state.cols - state.mines;
  if (state.revealedSafeCells !== safeCells) {
    return;
  }

  state.gameOver = true;
  state.win = true;
  stopTimer();

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
      }
    }
  }

  state.flagsPlaced = state.mines;
  setStatus("Board cleared. You win.", "win");
}

function setStatus(message, className) {
  statusElement.textContent = message;
  statusElement.className = className ? `status ${className}` : "status";
}

function updateHud() {
  mineCountElement.textContent = String(Math.max(state.mines - state.flagsPlaced, 0));
  timerElement.textContent = String(state.timer);

  if (state.gameOver) {
    faceButton.textContent = state.win ? "B)" : "X(";
    return;
  }

  faceButton.textContent = ":)";
}

function render() {
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.row = String(row);
      button.dataset.col = String(col);

      if (cell.revealed) {
        button.classList.add("revealed");
      }

      if (cell.flagged) {
        button.classList.add("flagged");
      }

      if (cell.mine && cell.revealed) {
        button.classList.add("mine");
      }

      if (cell.exploded) {
        button.classList.add("exploded");
      }

      if (cell.revealed) {
        if (cell.mine) {
          button.textContent = cellSymbols.mine;
        } else if (cell.adjacent > 0) {
          button.textContent = String(cell.adjacent);
          button.dataset.count = String(cell.adjacent);
        } else {
          button.textContent = cellSymbols.hidden;
        }
      } else if (cell.flagged) {
        button.textContent = cellSymbols.flag;
      } else {
        button.textContent = cellSymbols.hidden;
      }

      button.setAttribute(
        "aria-label",
        `Row ${row + 1}, column ${col + 1}${cell.flagged ? ", flagged" : ""}`
      );

      fragment.appendChild(button);
    }
  }

  boardElement.replaceChildren(fragment);
}

function handlePrimaryAction(row, col) {
  if (state.inputMode === "flag") {
    toggleFlag(row, col);
    return;
  }

  revealCell(row, col);
}

function setInputMode(mode) {
  state.inputMode = mode;
  revealModeButton.classList.toggle("active", mode === "reveal");
  flagModeButton.classList.toggle("active", mode === "flag");
}

boardElement.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) {
    return;
  }

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  handlePrimaryAction(row, col);
});

boardElement.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) {
    return;
  }

  event.preventDefault();
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  toggleFlag(row, col);
});

newGameButton.addEventListener("click", () => {
  createGame(difficultySelect.value);
});

faceButton.addEventListener("click", () => {
  createGame(difficultySelect.value);
});

difficultySelect.addEventListener("change", () => {
  createGame(difficultySelect.value);
});

revealModeButton.addEventListener("click", () => {
  setInputMode("reveal");
});

flagModeButton.addEventListener("click", () => {
  setInputMode("flag");
});

createGame("beginner");
