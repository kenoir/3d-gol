/**
 * 3D Game of Life Simulation Logic
 * 
 * This module contains the core logic for running Conway's Game of Life in 3D space.
 * Each cell has 26 neighbors in a 3x3x3 cube (excluding the center cell).
 */

export interface GameOfLife3DConfig {
  gridSize: number;
  birthRule: number;
  survivalMin: number;
  survivalMax: number;
  periodicBoundaries: boolean;
}

export type Grid3D = number[][][];

export class GameOfLife3D {
  private config: GameOfLife3DConfig;

  constructor(config: GameOfLife3DConfig) {
    this.config = config;
  }

  /**
   * Creates an empty 3D grid filled with zeros
   */
  createEmptyGrid(): Grid3D {
    const { gridSize } = this.config;
    return Array(gridSize).fill(null).map(() =>
      Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(0)
      )
    );
  }

  /**
   * Creates a random grid with the specified density
   */
  createRandomGrid(density: number): Grid3D {
    const grid = this.createEmptyGrid();
    const { gridSize } = this.config;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          grid[x][y][z] = Math.random() < density ? 1 : 0;
        }
      }
    }

    return grid;
  }

  /**
   * Counts the number of living neighbors for a cell at position (x, y, z)
   */
  countNeighbors(grid: Grid3D, x: number, y: number, z: number): number {
    const { gridSize, periodicBoundaries } = this.config;
    let count = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          // Skip the center cell (the cell itself)
          if (dx === 0 && dy === 0 && dz === 0) continue;

          let nx = x + dx;
          let ny = y + dy;
          let nz = z + dz;

          if (periodicBoundaries) {
            // Wrap around edges (toroidal topology)
            nx = (nx + gridSize) % gridSize;
            ny = (ny + gridSize) % gridSize;
            nz = (nz + gridSize) % gridSize;
          } else {
            // Check bounds for non-periodic boundaries
            if (nx < 0 || nx >= gridSize || 
                ny < 0 || ny >= gridSize || 
                nz < 0 || nz >= gridSize) {
              continue;
            }
          }

          count += grid[nx][ny][nz];
        }
      }
    }

    return count;
  }

  /**
   * Applies the Game of Life rules to determine if a cell should be alive in the next generation
   */
  applyCellRule(isCurrentlyAlive: boolean, neighborCount: number): boolean {
    const { birthRule, survivalMin, survivalMax } = this.config;

    if (isCurrentlyAlive) {
      // Survival rule: live cell survives if it has the right number of neighbors
      return neighborCount >= survivalMin && neighborCount <= survivalMax;
    } else {
      // Birth rule: dead cell becomes alive if it has exactly the birth number of neighbors
      return neighborCount === birthRule;
    }
  }

  /**
   * Advances the simulation by one generation
   */
  step(currentGrid: Grid3D): Grid3D {
    const { gridSize } = this.config;
    const newGrid = this.createEmptyGrid();

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const neighbors = this.countNeighbors(currentGrid, x, y, z);
          const isCurrentlyAlive = currentGrid[x][y][z] === 1;
          const shouldBeAlive = this.applyCellRule(isCurrentlyAlive, neighbors);
          
          newGrid[x][y][z] = shouldBeAlive ? 1 : 0;
        }
      }
    }

    return newGrid;
  }

  /**
   * Counts the total number of living cells in the grid
   */
  countLivingCells(grid: Grid3D): number {
    const { gridSize } = this.config;
    let count = 0;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          count += grid[x][y][z];
        }
      }
    }

    return count;
  }

  /**
   * Checks if two grids are identical
   */
  gridsEqual(grid1: Grid3D, grid2: Grid3D): boolean {
    const { gridSize } = this.config;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          if (grid1[x][y][z] !== grid2[x][y][z]) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Copies a grid (deep copy)
   */
  copyGrid(grid: Grid3D): Grid3D {
    const { gridSize } = this.config;
    const newGrid = this.createEmptyGrid();

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          newGrid[x][y][z] = grid[x][y][z];
        }
      }
    }

    return newGrid;
  }

  /**
   * Sets a cell's state at the given position
   */
  setCell(grid: Grid3D, x: number, y: number, z: number, value: number): void {
    const { gridSize } = this.config;
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && z >= 0 && z < gridSize) {
      grid[x][y][z] = value;
    }
  }

  /**
   * Gets a cell's state at the given position
   */
  getCell(grid: Grid3D, x: number, y: number, z: number): number {
    const { gridSize } = this.config;
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && z >= 0 && z < gridSize) {
      return grid[x][y][z];
    }
    return 0;
  }

  /**
   * Updates the configuration
   */
  updateConfig(newConfig: Partial<GameOfLife3DConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): GameOfLife3DConfig {
    return { ...this.config };
  }
}
