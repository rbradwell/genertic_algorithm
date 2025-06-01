const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

let maxFrameCount = 0;

let frameCount = 0;
let gameOver = false;

const ballRadius = 10;
let x = canvas.width / 2;
let y = canvas.height - 30;
let dx = 2;
let dy = -2;

const paddleHeight = 10;
const paddleWidth = 75;
let paddleX = (canvas.width - paddleWidth) / 2;

const brickRowCount = 5;
const brickColumnCount = 3;
const brickWidth = 75;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 30;
const brickOffsetLeft = 30;

let score = 0;

const bricks = [];
for (let c = 0; c < brickColumnCount; c++) {
  bricks[c] = [];
  for (let r = 0; r < brickRowCount; r++) {
    bricks[c][r] = { x: 0, y: 0, status: 1 };
  }
}

// Web Worker and GA Variables
let gaWorker = null;
let bestIndividualsQueue = []; // Queue of best individuals to display
let currentDisplayIndividual = null;
let currentState = 0;
let generationStats = [];
let isPlayingBestIndividual = false;
let displayInterval = null;
let bestIndividualEver = null;
let lastBestFitness = -1; // Track the last best fitness to detect improvements

// Genetic Algorithm Configuration (keep for reference)
const POPULATION_SIZE = 20;
const MUTATION_RATE = 0.1;
const CROSSOVER_RATE = 0.7;
const MAX_GAME_TIME = 3000;
const NUM_STATES = 8;
const NUM_INPUTS = 6;

// Add canvas for the graph
let graphCanvas = null;
let graphCtx = null;

// Graph configuration
const GRAPH_WIDTH = 400;
const GRAPH_HEIGHT = 200;
const GRAPH_MARGIN = 40;

function initializeGraph() {
  // Create graph canvas
  graphCanvas = document.createElement("canvas");
  graphCanvas.width = GRAPH_WIDTH;
  graphCanvas.height = GRAPH_HEIGHT;
  graphCanvas.style.border = "1px solid #ccc";
  graphCanvas.style.marginTop = "10px";
  graphCtx = graphCanvas.getContext("2d");

  // Add to gaDisplay
  const gaDisplayElement = document.getElementById("gaDisplay");
  if (gaDisplayElement) {
    // Check if graph container already exists
    let graphContainer = document.getElementById("graph-container");
    if (!graphContainer) {
      graphContainer = document.createElement("div");
      graphContainer.id = "graph-container";
      graphContainer.innerHTML = "<h3>Fitness Progress</h3>";
      graphContainer.appendChild(graphCanvas);
      gaDisplayElement.appendChild(graphContainer);
      console.log("Graph container created and added to gaDisplay");
    }
  } else {
    console.error("gaDisplay element not found when initializing graph!");
  }
}

function drawGraph() {
  if (!graphCtx || generationStats.length === 0) return;

  // Clear canvas
  graphCtx.clearRect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT);

  // Get data ranges
  const maxGeneration = Math.max(1, generationStats.length);
  const allFitnesses = generationStats.flatMap((stat) => [
    stat.bestFitness,
    stat.avgFitness,
  ]);
  const maxFitness = Math.max(...allFitnesses, 100);
  const minFitness = Math.min(...allFitnesses, 0);
  const fitnessRange = maxFitness - minFitness || 1;

  // Draw axes
  graphCtx.strokeStyle = "#333";
  graphCtx.lineWidth = 1;
  graphCtx.beginPath();
  // Y-axis
  graphCtx.moveTo(GRAPH_MARGIN, GRAPH_MARGIN);
  graphCtx.lineTo(GRAPH_MARGIN, GRAPH_HEIGHT - GRAPH_MARGIN);
  // X-axis
  graphCtx.moveTo(GRAPH_MARGIN, GRAPH_HEIGHT - GRAPH_MARGIN);
  graphCtx.lineTo(GRAPH_WIDTH - GRAPH_MARGIN, GRAPH_HEIGHT - GRAPH_MARGIN);
  graphCtx.stroke();

  // Draw grid lines and labels
  graphCtx.strokeStyle = "#eee";
  graphCtx.fillStyle = "#666";
  graphCtx.font = "10px Arial";

  // Y-axis labels and grid
  for (let i = 0; i <= 5; i++) {
    const y = GRAPH_MARGIN + (i / 5) * (GRAPH_HEIGHT - 2 * GRAPH_MARGIN);
    const fitness = maxFitness - (i / 5) * fitnessRange;

    graphCtx.beginPath();
    graphCtx.moveTo(GRAPH_MARGIN, y);
    graphCtx.lineTo(GRAPH_WIDTH - GRAPH_MARGIN, y);
    graphCtx.stroke();

    graphCtx.fillText(fitness.toFixed(0), 5, y + 3);
  }

  // X-axis labels and grid
  const xStep = Math.max(1, Math.floor(maxGeneration / 10));
  for (let gen = 0; gen <= maxGeneration; gen += xStep) {
    const x =
      GRAPH_MARGIN + (gen / maxGeneration) * (GRAPH_WIDTH - 2 * GRAPH_MARGIN);

    graphCtx.beginPath();
    graphCtx.moveTo(x, GRAPH_MARGIN);
    graphCtx.lineTo(x, GRAPH_HEIGHT - GRAPH_MARGIN);
    graphCtx.stroke();

    graphCtx.fillText(gen.toString(), x - 10, GRAPH_HEIGHT - 10);
  }

  if (generationStats.length < 2) return;

  // Helper function to convert data to canvas coordinates
  function getX(generation) {
    return (
      GRAPH_MARGIN +
      ((generation - 1) / maxGeneration) * (GRAPH_WIDTH - 2 * GRAPH_MARGIN)
    );
  }

  function getY(fitness) {
    return (
      GRAPH_MARGIN +
      (1 - (fitness - minFitness) / fitnessRange) *
        (GRAPH_HEIGHT - 2 * GRAPH_MARGIN)
    );
  }

  // Draw best fitness line
  graphCtx.strokeStyle = "#ff4444";
  graphCtx.lineWidth = 2;
  graphCtx.beginPath();

  let bestSoFar = 0;
  for (let i = 0; i < generationStats.length; i++) {
    const stat = generationStats[i];
    bestSoFar = Math.max(bestSoFar, stat.bestFitness);
    const x = getX(stat.generation);
    const y = getY(bestSoFar);

    if (i === 0) {
      graphCtx.moveTo(x, y);
    } else {
      graphCtx.lineTo(x, y);
    }
  }
  graphCtx.stroke();

  // Draw average fitness line
  graphCtx.strokeStyle = "#4444ff";
  graphCtx.lineWidth = 2;
  graphCtx.beginPath();

  for (let i = 0; i < generationStats.length; i++) {
    const stat = generationStats[i];
    const x = getX(stat.generation);
    const y = getY(stat.avgFitness);

    if (i === 0) {
      graphCtx.moveTo(x, y);
    } else {
      graphCtx.lineTo(x, y);
    }
  }
  graphCtx.stroke();

  // Draw legend
  graphCtx.fillStyle = "#333";
  graphCtx.font = "12px Arial";

  // Best fitness legend
  graphCtx.fillStyle = "#ff4444";
  graphCtx.fillRect(GRAPH_WIDTH - 150, 20, 15, 3);
  graphCtx.fillStyle = "#333";
  graphCtx.fillText("Best So Far", GRAPH_WIDTH - 130, 25);

  // Average fitness legend
  graphCtx.fillStyle = "#4444ff";
  graphCtx.fillRect(GRAPH_WIDTH - 150, 35, 15, 3);
  graphCtx.fillStyle = "#333";
  graphCtx.fillText("Generation Avg", GRAPH_WIDTH - 130, 40);
}

// FSA Input encoding
function getFSAInputs() {
  const ballX = x / canvas.width; // Normalized ball X position
  const ballY = y / canvas.height; // Normalized ball Y position
  const paddleX_norm = paddleX / (canvas.width - paddleWidth); // Normalized paddle X
  const ballDX = dx > 0 ? 1 : 0; // Ball moving right or left
  const ballDY = dy > 0 ? 1 : 0; // Ball moving down or up

  return [
    ballX < 0.33 ? 1 : 0, // Ball in left third
    ballX > 0.66 ? 1 : 0, // Ball in right third
    ballY > 0.7 ? 1 : 0, // Ball in lower area
    paddleX_norm < ballX ? 1 : 0, // Paddle left of ball
    ballDX, // Ball moving right
    ballDY, // Ball moving down
  ];
}

// Add this function before the initializeWorker function
function updateGADisplay() {
  console.log("updateGADisplay called");
  console.log("generationStats:", generationStats);
  console.log("currentDisplayIndividual:", currentDisplayIndividual);
  console.log("bestIndividualEver:", bestIndividualEver);

  // Get the main gaDisplay element
  const gaDisplayElement = document.getElementById("gaDisplay");
  console.log("gaDisplayElement found:", !!gaDisplayElement);

  if (!gaDisplayElement) {
    console.error("gaDisplay element not found!");
    return;
  }

  // Initialize graph if it doesn't exist
  if (!graphCanvas) {
    initializeGraph();
  }

  // Find or create the stats container
  let statsContainer = document.getElementById("ga-stats-container");
  if (!statsContainer) {
    statsContainer = document.createElement("div");
    statsContainer.id = "ga-stats-container";
    gaDisplayElement.appendChild(statsContainer);
  }

  // Build the stats HTML content
  let statsHTML = "";

  // Generation statistics
  if (generationStats.length > 0) {
    const latest = generationStats[generationStats.length - 1];
    statsHTML += `
      <div id="ga-stats">
        <h3>Genetic Algorithm Progress</h3>
        <p><strong>Generation:</strong> ${latest.generation}</p>
        <p><strong>Best Fitness:</strong> ${latest.bestFitness.toFixed(2)}</p>
        <p><strong>Average Fitness:</strong> ${latest.avgFitness.toFixed(2)}</p>
        <p><strong>Worst Fitness:</strong> ${latest.worstFitness.toFixed(2)}</p>
      </div>
    `;
  } else {
    statsHTML += `
      <div id="ga-stats">
        <h3>Genetic Algorithm Progress</h3>
        <p><strong>Status:</strong> Waiting for genetic algorithm...</p>
        <p><strong>Worker:</strong> ${
          gaWorker ? "Initialized" : "Not initialized"
        }</p>
        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
      </div>
    `;
  }

  // Current individual
  if (currentDisplayIndividual) {
    statsHTML += `
      <div id="current-individual">
        <h3>Current Individual</h3>
        <p><strong>Generation:</strong> ${
          currentDisplayIndividual.generation || "N/A"
        }</p>
        <p><strong>Fitness:</strong> ${currentDisplayIndividual.fitness.toFixed(
          2
        )}</p>
        <p><strong>FSA Length:</strong> ${
          currentDisplayIndividual.states.length
        } states</p>
        <p><strong>Current State:</strong> ${currentState}</p>
      </div>
    `;
  } else {
    statsHTML += `
      <div id="current-individual">
        <h3>Current Individual</h3>
        <p><strong>Status:</strong> No individual playing yet</p>
      </div>
    `;
  }

  // Best individual ever with JSON display
  if (bestIndividualEver) {
    statsHTML += `
      <div id="best-individual">
        <h3>Best Individual Ever</h3>
        <p><strong>Generation:</strong> ${
          bestIndividualEver.generation || "N/A"
        }</p>
        <p><strong>Fitness:</strong> ${bestIndividualEver.fitness.toFixed(
          2
        )}</p>
        <p><strong>FSA Length:</strong> ${
          bestIndividualEver.states.length
        } states</p>
        ${
          bestIndividualEver.gameCompleted
            ? '<p><strong>Status:</strong> <span style="color: green;">GAME COMPLETED!</span></p>'
            : ""
        }
        
        <h4>FSA Structure (JSON):</h4>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 11px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd;">
${JSON.stringify(
  {
    generation: bestIndividualEver.generation,
    fitness: bestIndividualEver.fitness,
    gameCompleted: bestIndividualEver.gameCompleted || false,
    numStates: bestIndividualEver.states.length,
    states: bestIndividualEver.states.map((state, index) => ({
      stateIndex: index,
      action: state.action,
      transitions: state.transitions,
    })),
  },
  null,
  2
)}
        </pre>
      </div>
    `;
  } else {
    statsHTML += `
      <div id="best-individual">
        <h3>Best Individual Ever</h3>
        <p><strong>Status:</strong> Searching for best individual...</p>
      </div>
    `;
  }

  // Update only the stats container, not the entire gaDisplay
  statsContainer.innerHTML = statsHTML;

  // Only update graph if best fitness has improved or this is the first update
  const currentBestFitness = bestIndividualEver
    ? bestIndividualEver.fitness
    : 0;
  if (currentBestFitness > lastBestFitness || lastBestFitness === -1) {
    console.log(
      `Graph update: Best fitness improved from ${lastBestFitness} to ${currentBestFitness}`
    );
    drawGraph();
    lastBestFitness = currentBestFitness;
  } else {
    console.log(
      `Graph update skipped: Best fitness unchanged at ${currentBestFitness}`
    );
  }

  console.log("GA Display update complete");
}

// Initialize web worker
function initializeWorker() {
  try {
    gaWorker = new Worker("ga-worker.js");
    console.log("Web worker created successfully");
  } catch (error) {
    console.error("Failed to create web worker:", error);
    startSimpleDemo();
    return;
  }

  gaWorker.onmessage = function (e) {
    console.log("Received message from worker:", e.data.type, e.data);
    const { type } = e.data;

    switch (type) {
      case "newBestIndividual":
        console.log("New best individual received:", e.data.individual);
        bestIndividualsQueue.push({
          individual: e.data.individual,
          timestamp: Date.now(),
        });
        if (e.data.generationStats) {
          generationStats = e.data.generationStats;
        }
        bestIndividualEver = e.data.individual;
        updateGADisplay();

        if (!isPlayingBestIndividual && bestIndividualsQueue.length === 1) {
          playNextBestIndividual();
        }
        break;

      case "evolutionComplete":
        console.log(
          "Evolution completed! Perfect solution found:",
          e.data.individual
        );
        bestIndividualsQueue.push({
          individual: e.data.individual,
          timestamp: Date.now(),
        });
        if (e.data.generationStats) {
          generationStats = e.data.generationStats;
        }
        bestIndividualEver = e.data.individual;

        // Show completion message
        //alert(e.data.message || "Perfect solution found!");

        updateGADisplay();

        if (!isPlayingBestIndividual) {
          playNextBestIndividual();
        }
        break;

      case "generationUpdate":
        console.log("Generation update received:", e.data.generationStats);
        if (e.data.generationStats) {
          generationStats = e.data.generationStats;
        }
        updateGADisplay();
        break;

      case "stats":
        console.log("Stats received:", e.data);
        if (e.data.generationStats) {
          generationStats = e.data.generationStats;
        }
        if (e.data.bestIndividualEver) {
          bestIndividualEver = e.data.bestIndividualEver;
          // Only start playing if no individual is currently playing AND queue is empty
          if (
            !isPlayingBestIndividual &&
            bestIndividualsQueue.length === 0 &&
            !currentDisplayIndividual
          ) {
            bestIndividualsQueue.push({
              individual: e.data.bestIndividualEver,
              timestamp: Date.now(),
            });
            playNextBestIndividual();
          }
        }
        updateGADisplay();
        break;
    }
  };

  gaWorker.onerror = function (error) {
    console.error("Web worker error:", error);
    startSimpleDemo();
  };

  // Initialize the worker
  gaWorker.postMessage({
    type: "init",
    data: {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      paddleWidth: paddleWidth,
      brickRowCount: brickRowCount,
      brickColumnCount: brickColumnCount,
    },
  });

  // Request stats periodically
  setInterval(() => {
    if (gaWorker) {
      console.log("Requesting stats from worker...");
      gaWorker.postMessage({ type: "getStats" });
    }
  }, 1000);

  console.log("Initialization message sent to worker");
}

// Play next best individual from queue
function playNextBestIndividual() {
  if (bestIndividualsQueue.length === 0) {
    isPlayingBestIndividual = false;
    return;
  }

  const nextBest = bestIndividualsQueue.shift();
  currentDisplayIndividual = nextBest.individual;
  currentState = 0;
  isPlayingBestIndividual = true;

  resetGame();
  startDisplayMode();
}

function startDisplayMode() {
  if (displayInterval) {
    clearInterval(displayInterval);
  }
  displayInterval = setInterval(draw, 8); // ~60 FPS
}

function stopDisplayMode() {
  if (displayInterval) {
    clearInterval(displayInterval);
    displayInterval = null;
  }
}

function resetGame() {
  console.log("Resetting game...");
  frameCount = 0;
  score = 0;
  gameOver = false;

  // Reset ball and paddle positions
  x = canvas.width / 2;
  y = canvas.height - 30;
  dx = 2;
  dy = -2;
  paddleX = (canvas.width - paddleWidth) / 2;

  // Reset bricks
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r].status = 1;
    }
  }

  console.log(
    `Game reset - Ball: (${x}, ${y}), Paddle: ${paddleX}, Bricks: ${
      brickRowCount * brickColumnCount
    }`
  );
}

function drawTimer() {
  ctx.font = "16px Arial";
  ctx.fillStyle = "#0095DD";
  ctx.fillText("Timer: " + frameCount, canvas.width - 100, 20);
  ctx.fillText("Max Timer: " + maxFrameCount, canvas.width - 250, 20);
}

function getNextMovement() {
  if (!currentDisplayIndividual) return 0;

  // Get current inputs
  const inputs = getFSAInputs();

  // Convert inputs to index
  let inputIndex = 0;
  for (let i = 0; i < inputs.length; i++) {
    inputIndex += inputs[i] * Math.pow(2, i);
  }

  // Get action from current state
  const action = currentDisplayIndividual.states[currentState].action;

  // Transition to next state
  const nextState =
    currentDisplayIndividual.states[currentState].transitions[inputIndex];

  // Debug logging for problematic individuals
  if (currentDisplayIndividual.fitness > 10000 && frameCount % 30 === 0) {
    console.log(
      `FSA Debug - Frame ${frameCount}: State ${currentState} -> ${nextState}, Action: ${action}, Inputs: [${inputs.join(
        ","
      )}], InputIndex: ${inputIndex}`
    );
  }

  currentState = nextState;

  return action;
}

function collisionDetection() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      const b = bricks[c][r];
      if (b.status === 1) {
        if (
          x > b.x &&
          x < b.x + brickWidth &&
          y > b.y &&
          y < b.y + brickHeight
        ) {
          dy = -dy;
          b.status = 0;
          score++;
          if (score === brickRowCount * brickColumnCount) {
            gameOver = true;
          }
        }
      }
    }
  }
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#0095DD";
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.beginPath();
  ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);
  ctx.fillStyle = "#0095DD";
  ctx.fill();
  ctx.closePath();
}

function drawBricks() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (bricks[c][r].status === 1) {
        const brickX = r * (brickWidth + brickPadding) + brickOffsetLeft;
        const brickY = c * (brickHeight + brickPadding) + brickOffsetTop;
        bricks[c][r].x = brickX;
        bricks[c][r].y = brickY;
        ctx.beginPath();
        ctx.rect(brickX, brickY, brickWidth, brickHeight);
        ctx.fillStyle = "#0095DD";
        ctx.fill();
        ctx.closePath();
      }
    }
  }
}

function drawScore() {
  ctx.font = "16px Arial";
  ctx.fillStyle = "#0095DD";
  ctx.fillText("Score: " + score, 8, 20);
}

function draw() {
  if (gameOver) {
    console.log(
      `Game ended - Score: ${score}, Frames: ${frameCount}, Reason: Game Over`
    );
    stopDisplayMode();
    // Move to next best individual after a short delay
    setTimeout(() => {
      playNextBestIndividual();
    }, 1000);
    return;
  }

  // Add timeout check
  if (frameCount >= MAX_GAME_TIME) {
    console.log(
      `Game ended - Score: ${score}, Frames: ${frameCount}, Reason: Timeout`
    );
    gameOver = true;
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBricks();
  drawBall();
  drawPaddle();
  drawScore();
  drawTimer();

  // Show generation info
  if (currentDisplayIndividual) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FF0000";
    ctx.fillText(
      `Generation ${currentDisplayIndividual.generation}`,
      canvas.width / 2 - 60,
      50
    );
    ctx.fillText(
      `Fitness: ${currentDisplayIndividual.fitness.toFixed(2)}`,
      canvas.width / 2 - 60,
      70
    );
  }

  // Debug ball position
  if (frameCount % 60 === 0) {
    // Log every second
    console.log(
      `Frame ${frameCount}: Ball at (${x.toFixed(1)}, ${y.toFixed(
        1
      )}), velocity (${dx}, ${dy}), paddle at ${paddleX.toFixed(1)}`
    );
  }

  // Run one simulation step
  collisionDetection();

  // Ball collision with walls
  if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
    dx = -dx;
    console.log(`Ball bounced off side wall at frame ${frameCount}`);
  }
  if (y + dy < ballRadius) {
    dy = -dy;
    console.log(`Ball bounced off top wall at frame ${frameCount}`);
  } else if (y + dy > canvas.height - ballRadius) {
    if (x > paddleX && x < paddleX + paddleWidth) {
      dy = -dy;
      console.log(`Ball bounced off paddle at frame ${frameCount}`);
    } else {
      console.log(
        `Ball missed paddle at frame ${frameCount} - Ball X: ${x.toFixed(
          1
        )}, Paddle X: ${paddleX.toFixed(1)}-${(paddleX + paddleWidth).toFixed(
          1
        )}`
      );
      gameOver = true;
      return;
    }
  }

  const move = getNextMovement();
  if (move === 1 && paddleX < canvas.width - paddleWidth) {
    paddleX += 7;
  } else if (move === -1 && paddleX > 0) {
    paddleX -= 7;
  }

  x += dx;
  y += dy;
  frameCount++;

  // Additional bounds checking
  if (x < 0 || x > canvas.width || y < 0 || y > canvas.height + 50) {
    console.log(
      `Ball went out of bounds at frame ${frameCount}: (${x.toFixed(
        1
      )}, ${y.toFixed(1)})`
    );
    gameOver = true;
    return;
  }
}

// Add this function to handle the case when worker fails
function startSimpleDemo() {
  console.log("Starting simple demo mode (no genetic algorithm)");
  // Initialize a basic game without the genetic algorithm
  // You can implement a simple AI or manual controls here
}

// Initialize everything
console.log("Initializing game...");
initializeWorker();

// Force an immediate display update to show initial state
setTimeout(() => {
  console.log("Forcing initial display update...");
  updateGADisplay();
}, 100);

console.log("Game initialization complete");
