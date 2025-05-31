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

// Genetic Algorithm Configuration
const POPULATION_SIZE = 20;
const MUTATION_RATE = 0.1;
const CROSSOVER_RATE = 0.7;
const MAX_GAME_TIME = 3000; // Maximum frames per game to prevent infinite play
const NUM_STATES = 8; // Number of states in each FSA
const NUM_INPUTS = 6; // Number of input conditions

// GA Variables
let population = [];
let currentIndividualIndex = 0;
let generation = 1;
let currentFSA = null;
let currentState = 0;
let gameStartTime = 0;
let generationStats = []; // Track fitness over generations

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

// Create random FSA
function createRandomFSA() {
  const fsa = {
    states: [],
    fitness: 0
  };
  
  for (let state = 0; state < NUM_STATES; state++) {
    const stateData = {
      transitions: [],
      action: Math.floor(Math.random() * 3) - 1 // -1, 0, 1 (left, stay, right)
    };
    
    // Create transition table for all possible input combinations
    for (let input = 0; input < Math.pow(2, NUM_INPUTS); input++) {
      stateData.transitions.push(Math.floor(Math.random() * NUM_STATES));
    }
    
    fsa.states.push(stateData);
  }
  
  return fsa;
}

// Initialize population
function initializePopulation() {
  population = [];
  for (let i = 0; i < POPULATION_SIZE; i++) {
    population.push(createRandomFSA());
  }
  currentFSA = population[0];
}

// Calculate fitness
function calculateFitness(finalScore, finalFrameCount, gameCompleted) {
  let fitness = 0;
  
  // Base fitness from survival time
  fitness += finalFrameCount * 0.1;
  
  // Bonus for hitting blocks (much higher weight)
  fitness += finalScore * 100;
  
  // Huge bonus for completing the game
  if (gameCompleted) {
    fitness += 10000;
  }
  
  // Penalty for very short games (encourages survival)
  if (finalFrameCount < 100) {
    fitness *= 0.5;
  }
  
  return fitness;
}

// Tournament selection
function tournamentSelection() {
  const tournamentSize = 3;
  let best = population[Math.floor(Math.random() * population.length)];
  
  for (let i = 1; i < tournamentSize; i++) {
    const competitor = population[Math.floor(Math.random() * population.length)];
    if (competitor.fitness > best.fitness) {
      best = competitor;
    }
  }
  
  return JSON.parse(JSON.stringify(best)); // Deep copy
}

// Crossover
function crossover(parent1, parent2) {
  if (Math.random() > CROSSOVER_RATE) {
    return [JSON.parse(JSON.stringify(parent1)), JSON.parse(JSON.stringify(parent2))];
  }
  
  const child1 = JSON.parse(JSON.stringify(parent1));
  const child2 = JSON.parse(JSON.stringify(parent2));
  
  // Single point crossover on states
  const crossoverPoint = Math.floor(Math.random() * NUM_STATES);
  
  for (let i = crossoverPoint; i < NUM_STATES; i++) {
    [child1.states[i], child2.states[i]] = [child2.states[i], child1.states[i]];
  }
  
  return [child1, child2];
}

// Mutation
function mutate(individual) {
  for (let state = 0; state < NUM_STATES; state++) {
    // Mutate action
    if (Math.random() < MUTATION_RATE) {
      individual.states[state].action = Math.floor(Math.random() * 3) - 1;
    }
    
    // Mutate transitions
    for (let trans = 0; trans < individual.states[state].transitions.length; trans++) {
      if (Math.random() < MUTATION_RATE) {
        individual.states[state].transitions[trans] = Math.floor(Math.random() * NUM_STATES);
      }
    }
  }
}

// Create next generation
function createNextGeneration() {
  const newPopulation = [];
  
  // Calculate and store generation stats before creating new generation
  const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;
  const bestFitness = Math.max(...population.map(ind => ind.fitness));
  const worstFitness = Math.min(...population.map(ind => ind.fitness));
  
  generationStats.push({
    generation: generation,
    avgFitness: avgFitness,
    bestFitness: bestFitness,
    worstFitness: worstFitness,
    delta: generationStats.length > 0 ? avgFitness - generationStats[generationStats.length - 1].avgFitness : 0
  });
  
  // Keep best individual (elitism)
  const sortedPop = [...population].sort((a, b) => b.fitness - a.fitness);
  newPopulation.push(JSON.parse(JSON.stringify(sortedPop[0])));
  
  // Generate rest of population
  while (newPopulation.length < POPULATION_SIZE) {
    const parent1 = tournamentSelection();
    const parent2 = tournamentSelection();
    const [child1, child2] = crossover(parent1, parent2);
    
    mutate(child1);
    mutate(child2);
    
    child1.fitness = 0;
    child2.fitness = 0;
    
    newPopulation.push(child1);
    if (newPopulation.length < POPULATION_SIZE) {
      newPopulation.push(child2);
    }
  }
  
  population = newPopulation;
  generation++;
  currentIndividualIndex = 0;
  currentFSA = population[0];
  currentState = 0;
}

// Format FSA for display
function formatFSAForDisplay(fsa) {
  let output = "{\n";
  output += "  fitness: " + fsa.fitness.toFixed(2) + ",\n";
  output += "  states: [\n";
  
  for (let i = 0; i < fsa.states.length; i++) {
    const state = fsa.states[i];
    output += `    State ${i}: {\n`;
    output += `      action: ${state.action},\n`;
    output += `      transitions: [${state.transitions.join(', ')}]\n`;
    output += `    }${i < fsa.states.length - 1 ? ',' : ''}\n`;
  }
  
  output += "  ]\n}";
  return output;
}

// Update display
function updateGADisplay() {
  const gaDiv = document.getElementById('gaDisplay');
  if (!gaDiv) return;
  
  const bestIndividual = [...population].sort((a, b) => b.fitness - a.fitness)[0];
  const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;
  const currentStats = generationStats[generationStats.length - 1];
  
  // Generation history table
  let historyTable = '<table style="font-size: 12px; border-collapse: collapse; margin: 10px 0;">';
  historyTable += '<tr><th style="border: 1px solid #ccc; padding: 4px;">Gen</th><th style="border: 1px solid #ccc; padding: 4px;">Avg Fitness</th><th style="border: 1px solid #ccc; padding: 4px;">Delta</th><th style="border: 1px solid #ccc; padding: 4px;">Best</th></tr>';
  
  // Show last 10 generations
  const recentStats = generationStats.slice(-10);
  for (const stat of recentStats) {
    const deltaColor = stat.delta > 0 ? 'green' : stat.delta < 0 ? 'red' : 'black';
    historyTable += `<tr>
      <td style="border: 1px solid #ccc; padding: 4px;">${stat.generation}</td>
      <td style="border: 1px solid #ccc; padding: 4px;">${stat.avgFitness.toFixed(2)}</td>
      <td style="border: 1px solid #ccc; padding: 4px; color: ${deltaColor};">${stat.delta >= 0 ? '+' : ''}${stat.delta.toFixed(2)}</td>
      <td style="border: 1px solid #ccc; padding: 4px;">${stat.bestFitness.toFixed(2)}</td>
    </tr>`;
  }
  historyTable += '</table>';
  
  gaDiv.innerHTML = `
    <h3>Genetic Algorithm Status</h3>
    <p>Generation: ${generation}</p>
    <p>Individual: ${currentIndividualIndex + 1}/${POPULATION_SIZE}</p>
    <p>Current Avg Fitness: ${avgFitness.toFixed(2)}</p>
    <p>Best Fitness This Gen: ${bestIndividual.fitness.toFixed(2)}</p>
    
    <h4>Generation History (Last 10):</h4>
    ${historyTable}
    
    <h4>Best FSA:</h4>
    <pre style="font-size: 11px; max-height: 300px; overflow-y: auto; background: #f5f5f5; padding: 10px; border: 1px solid #ccc;">${formatFSAForDisplay(bestIndividual)}</pre>
  `;
}

function resetGame() {
  // Calculate fitness for current individual
  if (currentFSA) {
    const gameCompleted = score === brickRowCount * brickColumnCount;
    currentFSA.fitness = calculateFitness(score, frameCount, gameCompleted);
  }
  
  // Move to next individual or next generation
  currentIndividualIndex++;
  if (currentIndividualIndex >= POPULATION_SIZE) {
    createNextGeneration();
  } else {
    currentFSA = population[currentIndividualIndex];
    currentState = 0;
  }
  
  updateGADisplay();

  let totalThisGame = frameCount + score;
  if (totalThisGame > maxFrameCount) {
    maxFrameCount = totalThisGame;
  }

  frameCount = 0;
  score = 0;
  gameOver = false;
  gameStartTime = frameCount;

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
  if (!currentFSA) return 0;
  
  // Get current inputs
  const inputs = getFSAInputs();
  
  // Convert inputs to index
  let inputIndex = 0;
  for (let i = 0; i < inputs.length; i++) {
    inputIndex += inputs[i] * Math.pow(2, i);
  }
  
  // Get action from current state
  const action = currentFSA.states[currentState].action;
  
  // Transition to next state
  currentState = currentFSA.states[currentState].transitions[inputIndex];
  
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
            setTimeout(resetGame, 1000);
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
  if (gameOver) return;

  // Check for maximum game time to prevent infinite play
  if (frameCount - gameStartTime > MAX_GAME_TIME) {
    gameOver = true;
    setTimeout(resetGame, 100);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBricks();
  drawBall();
  drawPaddle();
  drawScore();
  drawTimer();
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
      setTimeout(resetGame, 100);
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

// Initialize GA and start
initializePopulation();
updateGADisplay();
setInterval(draw, 10);
