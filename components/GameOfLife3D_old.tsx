'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface VisualCell {
  scale: number;
  age: number;
}

const MAX_AGE = 15;
const FADE_SPEED = 0.15;

function SimulationGroup({ 
  gridSize, 
  logicGrid, 
  visualGrid, 
  isUserInteracting, 
  setIsUserInteracting 
}: {
  gridSize: number;
  logicGrid: number[][][];
  visualGrid: VisualCell[][][];
  isUserInteracting: boolean;
  setIsUserInteracting: (value: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useRef(new THREE.Object3D());
  const tempColor = useRef(new THREE.Color());

  // Auto-rotation when not interacting
  useFrame(() => {
    if (!isUserInteracting && groupRef.current) {
      groupRef.current.rotation.y += 0.002;
      groupRef.current.rotation.x += 0.001;
    }
    updateVisuals();
  });

  const updateVisuals = useCallback(() => {
    const cellInstances = instancedMeshRef.current;
    if (!cellInstances) return;

    let instanceIndex = 0;
    let needsColorUpdate = false;
    let needsMatrixUpdate = false;
    const centerOffset = -(gridSize - 1) / 2;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const visualCell = visualGrid[x][y][z];
          const targetScale = logicGrid[x][y][z];
          
          if (Math.abs(targetScale - visualCell.scale) > 0.001) {
            visualCell.scale += (targetScale - visualCell.scale) * FADE_SPEED;
            needsMatrixUpdate = true;
          } else if (visualCell.scale !== targetScale) {
            visualCell.scale = targetScale;
            needsMatrixUpdate = true;
          }
          
          tempObject.current.position.set(
            x + centerOffset, 
            y + centerOffset, 
            z + centerOffset
          );
          tempObject.current.scale.set(visualCell.scale, visualCell.scale, visualCell.scale);
          tempObject.current.updateMatrix();
          cellInstances.setMatrixAt(instanceIndex, tempObject.current.matrix);

          if (visualCell.scale > 0.01) {
            const ageRatio = Math.min(1, visualCell.age / MAX_AGE);
            const hue = 0.5 + ageRatio * 0.25;
            const lightness = 0.7 - ageRatio * 0.4; 
            tempColor.current.setHSL(hue, 1.0, lightness);
            cellInstances.setColorAt(instanceIndex, tempColor.current);
            needsColorUpdate = true;
          }
          instanceIndex++;
        }
      }
    }
    if (needsMatrixUpdate) cellInstances.instanceMatrix.needsUpdate = true;
    if (needsColorUpdate && cellInstances.instanceColor) cellInstances.instanceColor.needsUpdate = true;
  }, [gridSize, logicGrid, visualGrid]);

  // Handle user interaction detection
  const { gl } = useThree();
  useEffect(() => {
    const handlePointerDown = () => setIsUserInteracting(true);
    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    return () => gl.domElement.removeEventListener('pointerdown', handlePointerDown);
  }, [gl, setIsUserInteracting]);

  const totalCells = gridSize * gridSize * gridSize;

  return (
    <group ref={groupRef}>
      {/* Outer grid lines */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(gridSize, gridSize, gridSize)]} />
        <lineBasicMaterial color={0x4b5563} transparent opacity={0.5} />
      </lineSegments>
      
      {/* Instanced mesh for all cells */}
      <instancedMesh ref={instancedMeshRef} args={[new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshLambertMaterial({ transparent: true }), totalCells]} />
    </group>
  );
}

function Controls() {
  return <OrbitControls enableDamping dampingFactor={0.05} />;
}

export default function GameOfLife3D() {
  const [gridSize, setGridSize] = useState(20);
  const [logicGrid, setLogicGrid] = useState<number[][][]>([]);
  const [visualGrid, setVisualGrid] = useState<VisualCell[][][]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [aliveCells, setAliveCells] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [showRules, setShowRules] = useState(false);
  
  // Simulation parameters
  const [initialDensity, setInitialDensity] = useState(0.15);
  const [speed, setSpeed] = useState(500);
  const [birthRule, setBirthRule] = useState(5);
  const [survivalMin, setSurvivalMin] = useState(4);
  const [survivalMax, setSurvivalMax] = useState(5);
  
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  const createEmptyGrids = useCallback((size: number) => {
    const logic = Array(size).fill(0).map(() => 
      Array(size).fill(0).map(() => 
        Array(size).fill(0)
      )
    );
    const visual = Array(size).fill(0).map(() => 
      Array(size).fill(0).map(() => 
        Array(size).fill(0).map(() => ({ scale: 0, age: 0 }))
      )
    );
    return { logic, visual };
  }, []);

  const resetSimulation = useCallback((randomize = true) => {
    setIsUserInteracting(false);
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    setIsRunning(false);
    setGeneration(0);
    setAliveCells(0);

    const { logic, visual } = createEmptyGrids(gridSize);
    
    if (randomize) {
      let liveCount = 0;
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          for (let z = 0; z < gridSize; z++) {
            if (Math.random() < initialDensity) {
              logic[x][y][z] = 1;
              visual[x][y][z] = { scale: 1, age: 1 };
              liveCount++;
            }
          }
        }
      }
      setAliveCells(liveCount);
    }
    
    setLogicGrid(logic);
    setVisualGrid(visual);
  }, [gridSize, initialDensity, createEmptyGrids]);

  const clearSimulation = useCallback(() => {
    resetSimulation(false);
  }, [resetSimulation]);

  const countNeighbors = useCallback((grid: number[][][], x: number, y: number, z: number) => {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          if (i === 0 && j === 0 && k === 0) continue;
          
          // Periodic boundaries
          const nx = (x + i + gridSize) % gridSize;
          const ny = (y + j + gridSize) % gridSize;
          const nz = (z + k + gridSize) % gridSize;
          
          count += grid[nx][ny][nz];
        }
      }
    }
    return count;
  }, [gridSize]);

  const step = useCallback(() => {
    if (!logicGrid.length) return;

    const survivalRule: number[] = [];
    for (let i = survivalMin; i <= survivalMax; i++) {
      survivalRule.push(i);
    }
    
    setLogicGrid(prevLogicGrid => {
      const nextLogicGrid = prevLogicGrid.map(arr1 => arr1.map(arr2 => [...arr2]));
      let newAliveCount = 0;

      setVisualGrid(prevVisualGrid => {
        const nextVisualGrid = prevVisualGrid.map(arr1 => arr1.map(arr2 => [...arr2]));

        for (let x = 0; x < gridSize; x++) {
          for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
              const neighbors = countNeighbors(prevLogicGrid, x, y, z);
              const isAlive = prevLogicGrid[x][y][z] === 1;

              if (isAlive) {
                if (survivalRule.includes(neighbors)) {
                  nextLogicGrid[x][y][z] = 1;
                  nextVisualGrid[x][y][z].age = Math.min(MAX_AGE, prevVisualGrid[x][y][z].age + 1);
                  newAliveCount++;
                } else {
                  nextLogicGrid[x][y][z] = 0;
                  nextVisualGrid[x][y][z].age = 0;
                }
              } else {
                if (neighbors === birthRule) {
                  nextLogicGrid[x][y][z] = 1;
                  nextVisualGrid[x][y][z].age = 1;
                  newAliveCount++;
                }
              }
            }
          }
        }

        return nextVisualGrid;
      });

      setAliveCells(newAliveCount);
      setGeneration(prev => prev + 1);
      return nextLogicGrid;
    });
  }, [logicGrid.length, survivalMin, survivalMax, birthRule, gridSize, countNeighbors]);

  const startSimulation = useCallback(() => {
    if (simulationInterval.current) clearInterval(simulationInterval.current);
    simulationInterval.current = setInterval(step, 1050 - speed);
  }, [step, speed]);

  const stopSimulation = useCallback(() => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      stopSimulation();
    } else {
      setIsRunning(true);
      startSimulation();
    }
  }, [isRunning, startSimulation, stopSimulation]);

  // Handle speed changes while running
  useEffect(() => {
    if (isRunning) {
      stopSimulation();
      startSimulation();
    }
  }, [speed, isRunning, startSimulation, stopSimulation]);

  // Initialize simulation
  useEffect(() => {
    resetSimulation();
  }, [resetSimulation]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-gray-900 text-white overflow-hidden">
      {/* Full-screen Canvas */}
      <Canvas 
        camera={{ position: [gridSize * 1.5, gridSize * 1.5, gridSize * 1.5], fov: 75 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.8} color={0xcccccc} />
        <directionalLight 
          intensity={0.7} 
          position={[1, 1, 0.5]} 
          color={0xffffff} 
        />
        <Controls />
        <SimulationGroup 
          gridSize={gridSize}
          logicGrid={logicGrid}
          visualGrid={visualGrid}
          isUserInteracting={isUserInteracting}
          setIsUserInteracting={setIsUserInteracting}
        />
      </Canvas>

      {/* Stats Overlay - Top Left */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-sm pointer-events-none">
        <div className="space-y-1 font-mono text-xs">
          <div>Gen: {generation}</div>
          <div>Alive: {aliveCells}</div>
        </div>
      </div>

      {/* Main Controls - Top Right */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={togglePlayPause}
          className={`w-10 h-10 rounded-lg backdrop-blur-sm border border-white/20 flex items-center justify-center text-lg transition-all duration-200 hover:scale-105 ${
            isRunning 
              ? 'bg-red-500/80 hover:bg-red-400/80' 
              : 'bg-green-500/80 hover:bg-green-400/80'
          }`}
          title={isRunning ? 'Pause' : 'Play'}
        >
          {isRunning ? '⏸️' : '▶️'}
        </button>
        <button
          onClick={step}
          disabled={isRunning}
          className="w-10 h-10 rounded-lg backdrop-blur-sm border border-white/20 bg-blue-500/80 hover:bg-blue-400/80 flex items-center justify-center text-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          title="Step"
        >
          ⏭️
        </button>
        <button
          onClick={() => resetSimulation(true)}
          className="w-10 h-10 rounded-lg backdrop-blur-sm border border-white/20 bg-purple-500/80 hover:bg-purple-400/80 flex items-center justify-center text-lg transition-all duration-200 hover:scale-105"
          title="Randomize"
        >
          🎲
        </button>
        <button
          onClick={clearSimulation}
          className="w-10 h-10 rounded-lg backdrop-blur-sm border border-white/20 bg-gray-500/80 hover:bg-gray-400/80 flex items-center justify-center text-lg transition-all duration-200 hover:scale-105"
          title="Clear"
        >
          🗑️
        </button>
      </div>

      {/* Settings Toggle - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setShowParameters(!showParameters)}
          className="w-10 h-10 rounded-lg backdrop-blur-sm border border-white/20 bg-gray-700/80 hover:bg-gray-600/80 flex items-center justify-center text-lg transition-all duration-200 hover:scale-105"
          title="Parameters"
        >
          ⚙️
        </button>
        <button
          onClick={() => setShowRules(!showRules)}
          className="w-10 h-10 rounded-lg backdrop-blur-sm border border-white/20 bg-gray-700/80 hover:bg-gray-600/80 flex items-center justify-center text-lg transition-all duration-200 hover:scale-105"
          title="Rules"
        >
          📐
        </button>
      </div>

      {/* Parameters Panel */}
      {showParameters && (
        <div className="absolute bottom-20 right-4 z-10 w-80 bg-black/70 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Parameters</h3>
            <button
              onClick={() => setShowParameters(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Grid Size</label>
              <div className="flex items-center space-x-3">
                <input 
                  type="range" 
                  min="5" 
                  max="50" 
                  value={gridSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value);
                    if (newSize > 40) console.warn('Warning: Grid sizes above 40 may cause performance issues.');
                    setGridSize(newSize);
                  }}
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono text-xs w-8 text-center bg-gray-600 rounded px-1 py-0.5">
                  {gridSize}
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Density: {initialDensity.toFixed(2)}</label>
              <input 
                type="range" 
                min="0.01" 
                max="0.5" 
                step="0.01"
                value={initialDensity}
                onChange={(e) => setInitialDensity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Speed: {1050 - speed}ms</label>
              <input 
                type="range" 
                min="50" 
                max="1000" 
                step="10"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Rules Panel */}
      {showRules && (
        <div className="absolute bottom-20 right-4 z-10 w-80 bg-black/70 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Rules</h3>
            <button
              onClick={() => setShowRules(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-center text-gray-400 border-b border-gray-600 pb-2">
              Periodic Boundaries
            </p>
            
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Birth Neighbors</label>
              <div className="flex items-center space-x-3">
                <input 
                  type="range" 
                  min="1" 
                  max="26" 
                  value={birthRule}
                  onChange={(e) => setBirthRule(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono text-xs w-8 text-center bg-gray-600 rounded px-1 py-0.5">
                  {birthRule}
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Survival Range</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400 w-8">Min:</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="26" 
                    value={survivalMin}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSurvivalMin(val);
                      if (val > survivalMax) setSurvivalMax(val);
                    }}
                    className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="font-mono text-xs w-8 text-center bg-gray-600 rounded px-1 py-0.5">
                    {survivalMin}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400 w-8">Max:</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="26" 
                    value={survivalMax}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSurvivalMax(val);
                      if (val < survivalMin) setSurvivalMin(val);
                    }}
                    className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="font-mono text-xs w-8 text-center bg-gray-600 rounded px-1 py-0.5">
                    {survivalMax}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
