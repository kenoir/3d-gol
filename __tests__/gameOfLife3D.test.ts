/**
 * Tests for 3D Game of Life Logic
 */

import { GameOfLife3D, type GameOfLife3DConfig, type Grid3D } from '../lib/gameOfLife3D';

// Test configuration
const defaultConfig: GameOfLife3DConfig = {
  gridSize: 5,
  birthRule: 4,
  survivalMin: 4,
  survivalMax: 5,
  periodicBoundaries: true
};

describe('GameOfLife3D', () => {
  let game: GameOfLife3D;

  beforeEach(() => {
    game = new GameOfLife3D(defaultConfig);
  });

  describe('Grid Creation', () => {
    test('creates empty grid with correct dimensions', () => {
      const grid = game.createEmptyGrid();
      expect(grid.length).toBe(5);
      expect(grid[0].length).toBe(5);
      expect(grid[0][0].length).toBe(5);
      
      // Check all cells are 0
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          for (let z = 0; z < 5; z++) {
            expect(grid[x][y][z]).toBe(0);
          }
        }
      }
    });

    test('creates random grid with approximate density', () => {
      const density = 0.3;
      const grid = game.createRandomGrid(density);
      const livingCells = game.countLivingCells(grid);
      const totalCells = 5 * 5 * 5;
      const actualDensity = livingCells / totalCells;
      
      // Should be within reasonable range of target density
      expect(actualDensity).toBeGreaterThan(0.1);
      expect(actualDensity).toBeLessThan(0.6);
    });
  });

  describe('Neighbor Counting', () => {
    test('counts neighbors correctly in center of grid', () => {
      const grid = game.createEmptyGrid();
      // Set up a 3x3x3 cube of living cells around center
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            grid[2 + dx][2 + dy][2 + dz] = 1;
          }
        }
      }
      
      // Center cell should have 26 neighbors (all surrounding cells)
      const neighbors = game.countNeighbors(grid, 2, 2, 2);
      expect(neighbors).toBe(26);
    });

    test('counts neighbors correctly with some neighbors missing', () => {
      const grid = game.createEmptyGrid();
      // Set only a few neighbors
      grid[1][2][2] = 1; // left
      grid[3][2][2] = 1; // right
      grid[2][1][2] = 1; // front
      grid[2][3][2] = 1; // back
      
      const neighbors = game.countNeighbors(grid, 2, 2, 2);
      expect(neighbors).toBe(4);
    });

    test('handles periodic boundaries correctly', () => {
      const grid = game.createEmptyGrid();
      // Place a cell at corner
      grid[0][0][0] = 1;
      
      // Count neighbors at opposite corner - should see the corner cell due to wrapping
      const neighbors = game.countNeighbors(grid, 4, 4, 4);
      expect(neighbors).toBe(1);
    });

    test('handles non-periodic boundaries correctly', () => {
      const nonPeriodicConfig = { ...defaultConfig, periodicBoundaries: false };
      const nonPeriodicGame = new GameOfLife3D(nonPeriodicConfig);
      const grid = nonPeriodicGame.createEmptyGrid();
      
      // Place cell at corner
      grid[0][0][0] = 1;
      
      // Count neighbors at opposite corner - should not see the corner cell
      const neighbors = nonPeriodicGame.countNeighbors(grid, 4, 4, 4);
      expect(neighbors).toBe(0);
    });

    test('edge cell has correct neighbor count with periodic boundaries', () => {
      const grid = game.createEmptyGrid();
      // Fill entire grid except edge cell
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          for (let z = 0; z < 5; z++) {
            if (!(x === 0 && y === 0 && z === 0)) {
              grid[x][y][z] = 1;
            }
          }
        }
      }
      
      // Edge cell at (0,0,0) should have 26 neighbors due to periodic boundaries
      const neighbors = game.countNeighbors(grid, 0, 0, 0);
      expect(neighbors).toBe(26);
    });
  });

  describe('Cell Rules', () => {
    test('applies birth rule correctly', () => {
      // Dead cell with exactly birth number of neighbors should become alive
      const shouldBirth = game.applyCellRule(false, defaultConfig.birthRule);
      expect(shouldBirth).toBe(true);
      
      // Dead cell with different neighbor count should stay dead
      const shouldStayDead = game.applyCellRule(false, defaultConfig.birthRule + 1);
      expect(shouldStayDead).toBe(false);
    });

    test('applies survival rule correctly', () => {
      // Live cell with neighbors in survival range should survive
      const shouldSurviveMin = game.applyCellRule(true, defaultConfig.survivalMin);
      const shouldSurviveMax = game.applyCellRule(true, defaultConfig.survivalMax);
      const shouldSurviveMid = game.applyCellRule(true, (defaultConfig.survivalMin + defaultConfig.survivalMax) / 2);
      
      expect(shouldSurviveMin).toBe(true);
      expect(shouldSurviveMax).toBe(true);
      expect(shouldSurviveMid).toBe(true);
      
      // Live cell with neighbors outside survival range should die
      const shouldDieLow = game.applyCellRule(true, defaultConfig.survivalMin - 1);
      const shouldDieHigh = game.applyCellRule(true, defaultConfig.survivalMax + 1);
      
      expect(shouldDieLow).toBe(false);
      expect(shouldDieHigh).toBe(false);
    });
  });

  describe('Simulation Step', () => {
    test('empty grid stays empty', () => {
      const emptyGrid = game.createEmptyGrid();
      const nextGrid = game.step(emptyGrid);
      
      expect(game.gridsEqual(emptyGrid, nextGrid)).toBe(true);
      expect(game.countLivingCells(nextGrid)).toBe(0);
    });

    test('single cell dies (underpopulation)', () => {
      const grid = game.createEmptyGrid();
      grid[2][2][2] = 1; // Single cell in center
      
      const nextGrid = game.step(grid);
      expect(nextGrid[2][2][2]).toBe(0);
      expect(game.countLivingCells(nextGrid)).toBe(0);
    });

    test('stable configuration with correct neighbor count', () => {
      const grid = game.createEmptyGrid();
      
      // Create a configuration where center cell has exactly 4 neighbors (survival)
      grid[2][2][2] = 1; // center
      grid[1][2][2] = 1; // neighbor 1
      grid[3][2][2] = 1; // neighbor 2
      grid[2][1][2] = 1; // neighbor 3
      grid[2][3][2] = 1; // neighbor 4
      
      const nextGrid = game.step(grid);
      
      // Center cell should survive (has 4 neighbors, which is in survival range 4-5)
      expect(nextGrid[2][2][2]).toBe(1);
    });

    test('birth occurs with correct neighbor count', () => {
      const grid = game.createEmptyGrid();
      
      // Create exactly 4 living neighbors around an empty center cell
      grid[1][2][2] = 1;
      grid[3][2][2] = 1;
      grid[2][1][2] = 1;
      grid[2][3][2] = 1;
      // Center cell at [2][2][2] is empty but has 4 neighbors
      
      const nextGrid = game.step(grid);
      
      // Center cell should be born (has exactly 4 neighbors, which matches birth rule)
      expect(nextGrid[2][2][2]).toBe(1);
    });

    test('overpopulation causes death', () => {
      const grid = game.createEmptyGrid();
      
      // Create a center cell with too many neighbors (more than survivalMax)
      grid[2][2][2] = 1; // center cell
      // Add 6 neighbors (more than survivalMax of 5)
      grid[1][2][2] = 1;
      grid[3][2][2] = 1;
      grid[2][1][2] = 1;
      grid[2][3][2] = 1;
      grid[2][2][1] = 1;
      grid[2][2][3] = 1;
      
      const nextGrid = game.step(grid);
      
      // Center cell should die (has 6 neighbors, which is > survivalMax of 5)
      expect(nextGrid[2][2][2]).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    test('counts living cells correctly', () => {
      const grid = game.createEmptyGrid();
      grid[0][0][0] = 1;
      grid[2][2][2] = 1;
      grid[4][4][4] = 1;
      
      expect(game.countLivingCells(grid)).toBe(3);
    });

    test('grids equal comparison works', () => {
      const grid1 = game.createEmptyGrid();
      const grid2 = game.createEmptyGrid();
      
      expect(game.gridsEqual(grid1, grid2)).toBe(true);
      
      grid1[2][2][2] = 1;
      expect(game.gridsEqual(grid1, grid2)).toBe(false);
      
      grid2[2][2][2] = 1;
      expect(game.gridsEqual(grid1, grid2)).toBe(true);
    });

    test('grid copying works correctly', () => {
      const original = game.createEmptyGrid();
      original[1][1][1] = 1;
      original[3][3][3] = 1;
      
      const copy = game.copyGrid(original);
      
      expect(game.gridsEqual(original, copy)).toBe(true);
      
      // Modifying copy shouldn't affect original
      copy[2][2][2] = 1;
      expect(game.gridsEqual(original, copy)).toBe(false);
      expect(original[2][2][2]).toBe(0);
    });

    test('setCell and getCell work correctly', () => {
      const grid = game.createEmptyGrid();
      
      game.setCell(grid, 2, 3, 4, 1);
      expect(game.getCell(grid, 2, 3, 4)).toBe(1);
      
      // Test bounds checking
      game.setCell(grid, -1, 0, 0, 1); // Should not crash
      game.setCell(grid, 10, 0, 0, 1); // Should not crash
      expect(game.getCell(grid, -1, 0, 0)).toBe(0);
      expect(game.getCell(grid, 10, 0, 0)).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    test('updates configuration correctly', () => {
      const newConfig = { birthRule: 6, survivalMin: 2 };
      game.updateConfig(newConfig);
      
      const config = game.getConfig();
      expect(config.birthRule).toBe(6);
      expect(config.survivalMin).toBe(2);
      expect(config.gridSize).toBe(5); // Should keep original value
    });

    test('getConfig returns copy not reference', () => {
      const config1 = game.getConfig();
      const config2 = game.getConfig();
      
      config1.birthRule = 999;
      expect(config2.birthRule).toBe(defaultConfig.birthRule);
    });
  });

  describe('Edge Cases and Stress Tests', () => {
    test('handles minimum grid size', () => {
      const smallGame = new GameOfLife3D({ ...defaultConfig, gridSize: 1 });
      const grid = smallGame.createEmptyGrid();
      grid[0][0][0] = 1;
      
      // Single cell with no neighbors should die
      const nextGrid = smallGame.step(grid);
      expect(nextGrid[0][0][0]).toBe(0);
    });

    test('full grid evolution', () => {
      const grid = game.createEmptyGrid();
      // Fill entire grid
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          for (let z = 0; z < 5; z++) {
            grid[x][y][z] = 1;
          }
        }
      }
      
      const nextGrid = game.step(grid);
      
      // With periodic boundaries, every cell has 26 neighbors
      // This is way more than survivalMax (5), so all cells should die
      expect(game.countLivingCells(nextGrid)).toBe(0);
    });

    test('rule validation with extreme values', () => {
      const extremeConfig: GameOfLife3DConfig = {
        gridSize: 3,
        birthRule: 26, // Maximum possible neighbors
        survivalMin: 0,
        survivalMax: 26,
        periodicBoundaries: true
      };
      
      const extremeGame = new GameOfLife3D(extremeConfig);
      const grid = extremeGame.createEmptyGrid();
      grid[1][1][1] = 1;
      
      // Should not crash with extreme rules
      const nextGrid = extremeGame.step(grid);
      expect(Array.isArray(nextGrid)).toBe(true);
    });
  });
});

// Helper function to run tests (for manual testing in browser console)
export function runBasicTests(): void {
  console.log('Running basic 3D Game of Life tests...');
  
  const config: GameOfLife3DConfig = {
    gridSize: 3,
    birthRule: 4,
    survivalMin: 4,
    survivalMax: 5,
    periodicBoundaries: true
  };
  
  const game = new GameOfLife3D(config);
  
  // Test 1: Empty grid
  const emptyGrid = game.createEmptyGrid();
  console.log('Empty grid created:', game.countLivingCells(emptyGrid) === 0 ? 'PASS' : 'FAIL');
  
  // Test 2: Single cell dies
  const singleCellGrid = game.createEmptyGrid();
  singleCellGrid[1][1][1] = 1;
  const afterStep = game.step(singleCellGrid);
  console.log('Single cell dies:', game.countLivingCells(afterStep) === 0 ? 'PASS' : 'FAIL');
  
  // Test 3: Neighbor counting
  const neighborTestGrid = game.createEmptyGrid();
  neighborTestGrid[0][1][1] = 1;
  neighborTestGrid[2][1][1] = 1;
  neighborTestGrid[1][0][1] = 1;
  neighborTestGrid[1][2][1] = 1;
  const neighborCount = game.countNeighbors(neighborTestGrid, 1, 1, 1);
  console.log('Neighbor counting:', neighborCount === 4 ? 'PASS' : 'FAIL');
  
  console.log('Basic tests completed!');
}
