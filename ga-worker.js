// Genetic Algorithm Web Worker
const POPULATION_SIZE = 20;
const MUTATION_RATE = 0.1;
const CROSSOVER_RATE = 0.7;
const MAX_GAME_TIME = 3000;
const NUM_STATES = 8;
const NUM_INPUTS = 6;

// Canvas dimensions (passed from main thread)
let canvasWidth = 480;
let canvasHeight = 320;

// Game constants (passed from main thread)
let paddleWidth = 75;
let brickRowCount = 5;
let brickColumnCount = 3;

// GA Variables
let population = [];
let currentIndividualIndex = 0;
let generation = 1;
let generationStats = [];
let bestIndividualEver = null;
let evolutionStopped = false;

// FSA Input encoding
function getFSAInputs(x, y, paddleX, dx, dy) {
  const ballX = x / canvasWidth;
  const ballY = y / canvasHeight;
  const paddleX_norm = paddleX / (canvasWidth - paddleWidth);
  const ballDX = dx > 0 ? 1 : 0;
  const ballDY = dy > 0 ? 1 : 0;
  
  return [
    ballX < 0.33 ? 1 : 0,
    ballX > 0.66 ? 1 : 0,
    ballY > 0.7 ? 1 : 0,
    paddleX_norm < ballX ? 1 : 0,
    ballDX,
    ballDY
  ];
}

// Create random FSA
function createRandomFSA() {
  const fsa = {
    states: [],
    fitness: 0,
    generation: generation
  };
  
  for (let state = 0; state < NUM_STATES; state++) {
    const stateData = {
      transitions: [],
      action: Math.floor(Math.random() * 3) - 1
    };
    
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
}

// Calculate fitness
function calculateFitness(finalScore, finalFrameCount, gameCompleted) {
  let fitness = 0;
  fitness += finalFrameCount * 0.1;
  fitness += finalScore * 100;
  if (gameCompleted) {
    fitness += 10000;
  }
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
  
  return JSON.parse(JSON.stringify(best));
}

// Crossover
function crossover(parent1, parent2) {
  if (Math.random() > CROSSOVER_RATE) {
    return [JSON.parse(JSON.stringify(parent1)), JSON.parse(JSON.stringify(parent2))];
  }
  
  const child1 = JSON.parse(JSON.stringify(parent1));
  const child2 = JSON.parse(JSON.stringify(parent2));
  
  const crossoverPoint = Math.floor(Math.random() * NUM_STATES);
  
  for (let i = crossoverPoint; i < NUM_STATES; i++) {
    [child1.states[i], child2.states[i]] = [child2.states[i], child1.states[i]];
  }
  
  child1.generation = generation;
  child2.generation = generation;
  
  return [child1, child2];
}

// Mutation
function mutate(individual) {
  for (let state = 0; state < NUM_STATES; state++) {
    if (Math.random() < MUTATION_RATE) {
      individual.states[state].action = Math.floor(Math.random() * 3) - 1;
    }
    
    for (let trans = 0; trans < individual.states[state].transitions.length; trans++) {
      if (Math.random() < MUTATION_RATE) {
        individual.states[state].transitions[trans] = Math.floor(Math.random() * NUM_STATES);
      }
    }
  }
}

// Create next generation
function createNextGeneration() {
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
  
  const newPopulation = [];
  const sortedPop = [...population].sort((a, b) => b.fitness - a.fitness);
  
  // Check for new best individual
  if (!bestIndividualEver || sortedPop[0].fitness > bestIndividualEver.fitness) {
    bestIndividualEver = JSON.parse(JSON.stringify(sortedPop[0]));
    bestIndividualEver.generation = generation;
    
    // Check if this individual completed the game (perfect solution)
    if (bestIndividualEver.gameCompleted) {
      evolutionStopped = true;
      console.log(`Perfect solution found in generation ${generation}! Stopping evolution.`);
      
      // Send completion message
      self.postMessage({
        type: 'evolutionComplete',
        individual: bestIndividualEver,
        generationStats: generationStats,
        message: `Perfect solution found in generation ${generation}!`
      });
      return; // Stop creating new generations
    }
    
    // Send new best individual to main thread
    self.postMessage({
      type: 'newBestIndividual',
      individual: bestIndividualEver,
      generationStats: generationStats
    });
  }
  
  newPopulation.push(JSON.parse(JSON.stringify(sortedPop[0])));
  
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
  
  // Send generation update
  self.postMessage({
    type: 'generationUpdate',
    generation: generation,
    generationStats: generationStats
  });
}

// Simulate a complete game for an individual
function simulateGame(fsa) {
  // Game state
  let frameCount = 0;
  let score = 0;
  let gameOver = false;
  
  // Ball state
  let x = canvasWidth / 2;
  let y = canvasHeight - 30;
  let dx = 2;
  let dy = -2;
  const ballRadius = 10;
  
  // Paddle state
  let paddleX = (canvasWidth - paddleWidth) / 2;
  const paddleHeight = 10;
  
  // Bricks state
  const brickWidth = 75;
  const brickHeight = 20;
  const brickPadding = 10;
  const brickOffsetTop = 30;
  const brickOffsetLeft = 30;
  
  const bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { 
        x: r * (brickWidth + brickPadding) + brickOffsetLeft,
        y: c * (brickHeight + brickPadding) + brickOffsetTop,
        status: 1 
      };
    }
  }
  
  let currentState = 0;
  
  while (!gameOver && frameCount < MAX_GAME_TIME) {
    // Collision detection with bricks
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const b = bricks[c][r];
        if (b.status === 1) {
          if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
            dy = -dy;
            b.status = 0;
            score++;
            if (score === brickRowCount * brickColumnCount) {
              gameOver = true;
              break;
            }
          }
        }
      }
      if (gameOver) break;
    }
    
    // Ball collision with walls
    if (x + dx > canvasWidth - ballRadius || x + dx < ballRadius) {
      dx = -dx;
    }
    if (y + dy < ballRadius) {
      dy = -dy;
    } else if (y + dy > canvasHeight - ballRadius) {
      if (x > paddleX && x < paddleX + paddleWidth) {
        dy = -dy;
      } else {
        gameOver = true;
        break;
      }
    }
    
    // Get FSA action
    const inputs = getFSAInputs(x, y, paddleX, dx, dy);
    let inputIndex = 0;
    for (let i = 0; i < inputs.length; i++) {
      inputIndex += inputs[i] * Math.pow(2, i);
    }
    
    const action = fsa.states[currentState].action;
    currentState = fsa.states[currentState].transitions[inputIndex];
    
    // Move paddle
    if (action === 1 && paddleX < canvasWidth - paddleWidth) {
      paddleX += 7;
    } else if (action === -1 && paddleX > 0) {
      paddleX -= 7;
    }
    
    // Move ball
    x += dx;
    y += dy;
    frameCount++;
  }
  
  const gameCompleted = score === brickRowCount * brickColumnCount;
  const fitness = calculateFitness(score, frameCount, gameCompleted);
  
  // Store game completion status in the FSA for later reference
  fsa.gameCompleted = gameCompleted;
  
  return fitness;
}

// Run evolution
function runEvolution() {
  // Check if evolution should stop
  if (evolutionStopped) {
    console.log('Evolution stopped - perfect solution found');
    return;
  }
  
  while (currentIndividualIndex < POPULATION_SIZE && !evolutionStopped) {
    // Evaluate current individual
    const currentFSA = population[currentIndividualIndex];
    currentFSA.fitness = simulateGame(currentFSA);
    
    currentIndividualIndex++;
    
    // Yield control occasionally to prevent blocking
    if (currentIndividualIndex % 5 === 0) {
      setTimeout(() => runEvolution(), 0);
      return;
    }
  }
  
  if (currentIndividualIndex >= POPULATION_SIZE && !evolutionStopped) {
    createNextGeneration();
    // Continue evolution if not stopped
    if (!evolutionStopped) {
      setTimeout(() => runEvolution(), 0);
    }
  }
}

// Message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      canvasWidth = data.canvasWidth;
      canvasHeight = data.canvasHeight;
      paddleWidth = data.paddleWidth;
      brickRowCount = data.brickRowCount;
      brickColumnCount = data.brickColumnCount;
      initializePopulation();
      runEvolution();
      break;
      
    case 'getStats':
      self.postMessage({
        type: 'stats',
        generation: generation,
        generationStats: generationStats,
        bestIndividualEver: bestIndividualEver
      });
      break;
  }
};