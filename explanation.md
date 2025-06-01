# Genetic Algorithm for Breakout Game - Technical Explanation

## 1. Genome Encoding & FSA Operation

### The Genome: Variable-Length Finite State Automata

Each individual in the population is encoded as a **Finite State Automaton (FSA)** with:

- **Variable number of states** (2-16 states)
- Each state contains:
  - An **action** (-1, 0, or 1 representing left, stay, right paddle movement)
  - A **transition table** with 64 entries (one for each possible input combination)

### Input Encoding (6 binary inputs)

The game state is converted into 6 binary inputs:

```javascript
[
  ballX < 0.33 ? 1 : 0, // Ball in left third of screen
  ballX > 0.66 ? 1 : 0, // Ball in right third of screen
  ballY > 0.7 ? 1 : 0, // Ball in lower 30% of screen
  paddleX < ballX ? 1 : 0, // Paddle is left of ball
  dx > 0 ? 1 : 0, // Ball moving right
  dy > 0 ? 1 : 0, // Ball moving down
];
```

### FSA Operation

1. **State Lookup**: Current state determines the paddle action
2. **Input Processing**: 6 binary inputs create an index (0-63) via binary encoding
3. **State Transition**: Transition table maps input index to next state
4. **Action Execution**: Current state's action moves the paddle

### Example FSA Structure (JSON)

```json
{
  "generation": 15,
  "fitness": 1247.5,
  "gameCompleted": false,
  "numStates": 3,
  "states": [
    {
      "stateIndex": 0,
      "action": -1,
      "transitions": [
        2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2, 1, 0,
        2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2, 1, 0,
        2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1, 0
      ]
    },
    {
      "stateIndex": 1,
      "action": 0,
      "transitions": [
        0, 2, 1, 2, 0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1,
        0, 2, 1, 2, 0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1,
        0, 2, 1, 2, 0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1
      ]
    },
    {
      "stateIndex": 2,
      "action": 1,
      "transitions": [
        1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 1, 0, 2, 1, 0, 2, 0, 1, 2, 0, 2, 1, 0, 2,
        1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 1, 0, 2, 1, 0, 2, 0, 1, 2, 0, 2, 1, 0, 2,
        1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 1, 0, 2, 1, 0, 2
      ]
    }
  ]
}
```

### Execution Example

**Scenario**: Ball in right third, lower area, moving left and down. Paddle is left of ball.

- **Inputs**: [0, 1, 1, 1, 0, 1] (right third, lower, paddle left of ball, ball moving left+down)
- **Input Index**: 0×1 + 1×2 + 1×4 + 1×8 + 0×16 + 1×32 = 46
- **Current State**: 0 (starting state)
- **Action**: -1 (move paddle left from state 0)
- **Next State**: transitions[46] = 2 (transition to state 2)
- **Result**: Paddle moves left, FSA transitions to state 2 for next frame

## 2. Evaluation Function (Fitness)

The fitness function rewards multiple objectives with length penalties:

```javascript
baseFitness = frameCount × 0.1 + score × 100
if (gameCompleted) baseFitness += 10000
if (frameCount < 100) baseFitness × 0.5  // Penalty for dying too quickly

// Parsimony pressure - penalize larger FSAs
lengthPenalty = (numStates - MIN_STATES) × LENGTH_PENALTY_FACTOR × 1000
finalFitness = max(0, baseFitness - lengthPenalty)
```

**Fitness Components**:

- **Survival time**: 0.1 points per frame (rewards staying alive)
- **Score**: 100 points per brick destroyed
- **Completion bonus**: 10,000 points for clearing all bricks
- **Quick death penalty**: 50% reduction if dying in <100 frames
- **Size penalty**: Larger FSAs lose points (encourages compact solutions)

## 3. Selection Mechanism: Tournament Selection

Uses **tournament selection** with tournament size of 3:

```javascript
function tournamentSelection() {
  let best = population[Math.floor(Math.random() * population.length)];
  for (let i = 1; i < 3; i++) {
    let competitor = population[Math.floor(Math.random() * population.length)];
    if (competitor.fitness > best.fitness) {
      best = competitor;
    }
  }
  return JSON.parse(JSON.stringify(best)); // Deep copy
}
```

**What happens to the selected individual**: The tournament winner becomes a **parent for reproduction**. In the `createNextGeneration()` function, tournament selection is called twice to pick two parents:

```javascript
const parent1 = tournamentSelection(); // First parent
const parent2 = tournamentSelection(); // Second parent
const [child1, child2] = crossover(parent1, parent2); // Create offspring
```

The selected individuals are then used for crossover and mutation to create the next generation. Better individuals have higher chances of being selected as parents, so their genetic material propagates through the population.

**Why Tournament Selection?**

- **Maintains diversity**: Doesn't overly favor the single best individual
- **Scalable**: Performance doesn't depend on population sorting
- **Tunable pressure**: Tournament size controls selection pressure

## 4. Crossover Operator: Variable-Length Crossover

Handles variable-length FSAs with adaptive offspring sizing. **Crossover takes two parents and produces two children** - this is standard in genetic algorithms because it maintains population size and maximizes the genetic material extracted from each pair of selected parents.

### Length Determination

```javascript
const minLen = min(parent1.length, parent2.length);
const maxLen = max(parent1.length, parent2.length);
child1Length = random(minLen, maxLen);
child2Length = random(minLen, maxLen);
```

### State-by-State Construction

For each state position in the child:

1. **Parent Selection**: Randomly choose parent1 or parent2 (50% chance each)
2. **State Copying**: Copy the corresponding state (or closest available)
3. **Transition Repair**: Ensure all transitions point to valid states in the child

### Transition Table Handling

```javascript
// Map transitions to valid range for child
child.transitions = parent.transitions.map((t) => Math.min(t, childLength - 1));
```

### Crossover Example

**Parent 1** (3 states):

```json
{
  "states": [
    {"action": -1, "transitions": [1, 2, 0, 1, 2, 0, ...]},  // State 0
    {"action": 0,  "transitions": [2, 0, 1, 2, 0, 1, ...]},  // State 1
    {"action": 1,  "transitions": [0, 1, 2, 0, 1, 2, ...]}   // State 2
  ]
}
```

**Parent 2** (4 states):

```json
{
  "states": [
    {"action": 1,  "transitions": [3, 1, 0, 2, 3, 1, ...]},  // State 0
    {"action": -1, "transitions": [0, 2, 3, 1, 0, 2, ...]},  // State 1
    {"action": 0,  "transitions": [1, 3, 2, 0, 1, 3, ...]},  // State 2
    {"action": 1,  "transitions": [2, 0, 1, 3, 2, 0, ...]}   // State 3
  ]
}
```

**Crossover Process**:

1. **Choose child lengths**: Child1 = 3 states, Child2 = 4 states
2. **For each state, randomly pick parent**:

**Child 1** (3 states):

- State 0: Choose Parent 2 → action=1, transitions from Parent 2 state 0
- State 1: Choose Parent 1 → action=0, transitions from Parent 1 state 1
- State 2: Choose Parent 2 → action=0, transitions from Parent 2 state 2

**Child 1 Before repair**:

```json
{
  "states": [
    {"action": 1,  "transitions": [3, 1, 0, 2, 3, 1, ...]},  // Invalid: state 3 doesn't exist!
    {"action": 0,  "transitions": [2, 0, 1, 2, 0, 1, ...]},  // Valid: all transitions ≤ 2
    {"action": 0,  "transitions": [1, 3, 2, 0, 1, 3, ...]}   // Invalid: state 3 doesn't exist!
  ]
}
```

**Child 1 After repair** (map all transitions ≥ 3 to valid range 0-2):

```json
{
  "states": [
    {"action": 1,  "transitions": [2, 1, 0, 2, 2, 1, ...]},  // State 3→2, others unchanged
    {"action": 0,  "transitions": [2, 0, 1, 2, 0, 1, ...]},  // No changes needed
    {"action": 0,  "transitions": [1, 2, 2, 0, 1, 2, ...]}   // State 3→2, others unchanged
  ]
}
```

**Why repair is needed**: When copying a state from a larger parent FSA into a smaller child, the transition table may contain references to states that don't exist in the child. For example, if we copy a state from Parent 2 (4 states) that has transitions pointing to "state 3", but our child only has 3 states (0, 1, 2), then "state 3" is invalid and would cause a runtime error. The repair step ensures all transition targets are within the valid range of the child FSA.

**Final Child 1**:

```json
{
  "states": [
    {"action": 1,  "transitions": [2, 1, 0, 2, 2, 1, ...]},  // From Parent 2, repaired
    {"action": 0,  "transitions": [2, 0, 1, 2, 0, 1, ...]},  // From Parent 1
    {"action": 0,  "transitions": [1, 2, 2, 0, 1, 2, ...]}   // From Parent 2, repaired
  ]
}
```

**Child 2** would be created using the same process but with independent random choices for parent selection at each state position, potentially resulting in a different combination of inherited traits.

**Why two children?** Creating two offspring from each parent pair:

1. **Doubles genetic diversity** - two different combinations of parental traits
2. **Maintains population size** - replaces two parents with two children
3. **Maximizes reproductive efficiency** - gets more value from the selection effort

**Key Features**:

- **Variable offspring sizes**: Children can be different lengths than parents
- **Flexible inheritance**: Each state can come from either parent
- **Automatic repair**: Invalid transitions are automatically fixed
- **Preserves structure**: Maintains FSA integrity while allowing mixing

## Summary

This GA evolves compact, efficient FSAs that can play Breakout by:

1. **Encoding** game strategies as state machines with sensory inputs
2. **Evaluating** performance, survival, and solution complexity
3. **Selecting** parents through competitive tournaments
4. **Combining** variable-length FSAs while maintaining structural validity

The system naturally discovers minimal FSAs that exhibit effective game-playing behaviors!
