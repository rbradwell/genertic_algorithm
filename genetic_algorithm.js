// Number of individuals in each generation
const POPULATION_SIZE = 100;

// Valid Genes
const GENES =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP" +
  'QRSTUVWXYZ 1234567890, .-;:_!"#%&/()=?@${[]}';

// Target string to be generated
const TARGET = "I love GeeksforGeeks";

// Function to generate random numbers in given range
function RandomNum(start, end) {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

// Create random genes for mutation
function MutatedGenes() {
  let len = GENES.length;
  let r = RandomNum(0, len - 1);
  return GENES.charAt(r);
}

// Create chromosome or string of genes
function CreateGnome() {
  let len = TARGET.length;
  let gnome = "";
  for (let i = 0; i < len; i++) {
    gnome += MutatedGenes();
  }
  return gnome;
}

// Class representing individual in population
class Individual {
  constructor(chromosome) {
    this.Chromosome = chromosome;
    this.Fitness = this.CalculateFitness();
  }

  // Calculate fitness score, it is the number of
  // characters in string which differ from target string.
  CalculateFitness() {
    let fitness = 0;
    for (let i = 0; i < this.Chromosome.length; i++) {
      if (this.Chromosome[i] !== TARGET[i]) {
        fitness++;
      }
    }
    return fitness;
  }

  // Perform mating and produce new offspring
  Mate(parent2) {
    let childChromosome = "";
    for (let i = 0; i < this.Chromosome.length; i++) {
      let p = Math.random();
      if (p < 0.45) childChromosome += this.Chromosome[i];
      else if (p < 0.9) childChromosome += parent2.Chromosome[i];
      else childChromosome += MutatedGenes();
    }
    return new Individual(childChromosome);
  }
}

// Overloading < operator
class FitnessComparer {
  static Compare(ind1, ind2) {
    return ind1.Fitness - ind2.Fitness;
  }
}

// Driver code
function Main() {
  // current generation
  let generation = 0;

  let population = [];
  let found = false;

  // create initial population
  for (let i = 0; i < POPULATION_SIZE; i++) {
    let gnome = CreateGnome();
    population.push(new Individual(gnome));
  }

  while (!found) {
    // sort the population in increasing order of fitness score
    population.sort((a, b) => FitnessComparer.Compare(a, b));

    // if the individual having lowest fitness score ie.
    // 0 then we know that we have reached the target
    // and break the loop
    if (population[0].Fitness === 0) {
      found = true;
      break;
    }

    // Otherwise generate new offsprings for new generation
    let newGeneration = [];

    // Perform Elitism, that means 10% of fittest population
    // goes to the next generation
    let s = Math.floor((10 * POPULATION_SIZE) / 100);
    for (let i = 0; i < s; i++) newGeneration.push(population[i]);

    // From 50% of fittest population, Individuals
    // will mate to produce offspring
    s = Math.floor((90 * POPULATION_SIZE) / 100);
    for (let i = 0; i < s; i++) {
      let r = RandomNum(0, 50);
      let parent1 = population[r];
      r = RandomNum(0, 50);
      let parent2 = population[r];
      let offspring = parent1.Mate(parent2);
      newGeneration.push(offspring);
    }
    population = newGeneration;
    console.log(
      "Generation: " +
        generation +
        "\t" +
        "String: " +
        population[0].Chromosome +
        "\t" +
        "Fitness: " +
        population[0].Fitness
    );

    generation++;
  }

  console.log(
    "Generation: " +
      generation +
      "\t" +
      "String: " +
      population[0].Chromosome +
      "\t" +
      "Fitness: " +
      population[0].Fitness
  );
}

// Execute the main function
Main();
