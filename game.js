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

// Genetic Algorithm Configuration (keep for reference)
const POPULATION_SIZE = 20;
const MUTATION_RATE = 0.1;
const CROSSOVER_RATE = 0.7;
const MAX_GAME_TIME = 3000;
const NUM_STATES = 8;
const NUM_INPUTS = 6;

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
    ballY > 0.7 ? 1 : 0,  // Ball in lower area
    paddleX_norm < ballX ? 1 : 0, // Paddle left of ball
    ballDX, // Ball moving right
    ballDY  // Ball moving down
  ];
}

// Add this function before the initializeWorker function
function updateGADisplay() {
  console.log('updateGADisplay called');
  console.log('generationStats:', generationStats);
  console.log('currentDisplayIndividual:', currentDisplayIndividual);
  console.log('bestIndividualEver:', bestIndividualEver);
  
  // Get the main gaDisplay element
  const gaDisplayElement = document.getElementById('gaDisplay');
  console.log('gaDisplayElement found:', !!gaDisplayElement);
  
  if (!gaDisplayElement) {
    console.error('gaDisplay element not found!');
    return;
  }
  
  // Build the complete HTML content
  let statsHTML = '';
  
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
        <p><strong>Worker:</strong> ${gaWorker ? 'Initialized' : 'Not initialized'}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
      </div>
    `;
  }
  
  // Current individual
  if (currentDisplayIndividual) {
    statsHTML += `
      <div id="current-individual">
        <h3>Current Individual</h3>
        <p><strong>Generation:</strong> ${currentDisplayIndividual.generation || 'N/A'}</p>
        <p><strong>Fitness:</strong> ${currentDisplayIndividual.fitness.toFixed(2)}</p>
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
  
  // Best individual ever
  if (bestIndividualEver) {
    statsHTML += `
      <div id="best-individual">
        <h3>Best Individual Ever</h3>
        <p><strong>Generation:</strong> ${bestIndividualEver.generation || 'N/A'}</p>
        <p><strong>Fitness:</strong> ${bestIndividualEver.fitness.toFixed(2)}</p>
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
  
  // Set the complete HTML
  gaDisplayElement.innerHTML = statsHTML;
  
  console.log('GA Display update complete');
}

// Initialize web worker
function initializeWorker() {
  try {
    gaWorker = new Worker('ga-worker.js');
    console.log('Web worker created successfully');
  } catch (error) {
    console.error('Failed to create web worker:', error);
    startSimpleDemo();
    return;
  }
  
  gaWorker.onmessage = function(e) {
    console.log('Received message from worker:', e.data.type, e.data);
    const { type } = e.data;
    
    switch (type) {
      case 'newBestIndividual':
        console.log('New best individual received:', e.data.individual);
        bestIndividualsQueue.push({
          individual: e.data.individual,
          timestamp: Date.now()
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
        
      case 'generationUpdate':
        console.log('Generation update received:', e.data.generationStats);
        if (e.data.generationStats) {
          generationStats = e.data.generationStats;
        }
        updateGADisplay();
        break;
        
      case 'stats':
        console.log('Stats received:', e.data);
        if (e.data.generationStats) {
          generationStats = e.data.generationStats;
        }
        if (e.data.bestIndividualEver) {
          bestIndividualEver = e.data.bestIndividualEver;
          if (bestIndividualsQueue.length === 0) {
            bestIndividualsQueue.push({
              individual: e.data.bestIndividualEver,
              timestamp: Date.now()
            });
            playNextBestIndividual();
          }
        }
        updateGADisplay();
        break;
    }
  };
  
  gaWorker.onerror = function(error) {
    console.error('Web worker error:', error);
    startSimpleDemo();
  };
  
  // Initialize the worker
  gaWorker.postMessage({
    type: 'init',
    data: {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      paddleWidth: paddleWidth,
      brickRowCount: brickRowCount,
      brickColumnCount: brickColumnCount
    }
  });
  
  // Request stats periodically
  setInterval(() => {
    if (gaWorker) {
      console.log('Requesting stats from worker...');
      gaWorker.postMessage({ type: 'getStats' });
    }
  }, 1000);
  
  console.log('Initialization message sent to worker');
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
  displayInterval = setInterval(draw, 16); // ~60 FPS
}

function stopDisplayMode() {
  if (displayInterval) {
    clearInterval(displayInterval);
    displayInterval = null;
  }
}

function resetGame() {
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
  currentState = currentDisplayIndividual.states[currentState].transitions[inputIndex];
  
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
    stopDisplayMode();
    // Move to next best individual after a short delay
    setTimeout(() => {
      playNextBestIndividual();
    }, 1000);
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
    ctx.fillText(`Generation ${currentDisplayIndividual.generation}`, canvas.width / 2 - 60, 50);
    ctx.fillText(`Fitness: ${currentDisplayIndividual.fitness.toFixed(2)}`, canvas.width / 2 - 60, 70);
  }
  
  // Run one simulation step
  collisionDetection();

  if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
    dx = -dx;
  }
  if (y + dy < ballRadius) {
    dy = -dy;
  } else if (y + dy > canvas.height - ballRadius) {
    if (x > paddleX && x < paddleX + paddleWidth) {
      dy = -dy;
    } else {
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
}

// Add this function to handle the case when worker fails
function startSimpleDemo() {
    console.log('Starting simple demo mode (no genetic algorithm)');
    // Initialize a basic game without the genetic algorithm
    // You can implement a simple AI or manual controls here
}

// Initialize everything
console.log('Initializing game...');
initializeWorker();

// Force an immediate display update to show initial state
setTimeout(() => {
  console.log('Forcing initial display update...');
  updateGADisplay();
}, 100);

console.log('Game initialization complete');
