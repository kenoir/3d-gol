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
          const isAlive = logicGrid[x][y][z] === 1;
          const visual = visualGrid[x][y][z];

          if (isAlive || visual.scale > 0.01) {
            // Update position
            tempObject.current.position.set(
              x + centerOffset,
              y + centerOffset,
              z + centerOffset
            );
            tempObject.current.scale.setScalar(visual.scale);
            tempObject.current.updateMatrix();
            cellInstances.setMatrixAt(instanceIndex, tempObject.current.matrix);

            // Update color based on age
            const ageRatio = Math.min(visual.age / MAX_AGE, 1);
            tempColor.current.setHSL(
              0.15 + ageRatio * 0.4, // Hue: yellow to cyan
              0.8,
              0.3 + ageRatio * 0.4
            );
            cellInstances.setColorAt(instanceIndex, tempColor.current);

            instanceIndex++;
            needsColorUpdate = true;
            needsMatrixUpdate = true;
          }
        }
      }
    }

    // Hide unused instances
    for (let i = instanceIndex; i < cellInstances.count; i++) {
      tempObject.current.scale.setScalar(0);
      tempObject.current.updateMatrix();
      cellInstances.setMatrixAt(i, tempObject.current.matrix);
      needsMatrixUpdate = true;
    }

    if (needsMatrixUpdate) {
      cellInstances.instanceMatrix.needsUpdate = true;
    }
    if (needsColorUpdate && cellInstances.instanceColor) {
      cellInstances.instanceColor.needsUpdate = true;
    }
  }, [gridSize, logicGrid, visualGrid]);

  const maxInstances = gridSize ** 3;

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, maxInstances]}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshPhongMaterial />
      </instancedMesh>
    </group>
  );
}

function Controls() {
  const { gl, camera } = useThree();
  
  useEffect(() => {
    const handlePointerDown = () => {};
    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    return () => gl.domElement.removeEventListener('pointerdown', handlePointerDown);
  }, [gl]);

  return (
    <OrbitControls
      camera={camera}
      domElement={gl.domElement}
      enableDamping={true}
      dampingFactor={0.05}
      maxDistance={50}
      minDistance={5}
    />
  );
}

export default function GameOfLife3D() {
  // State variables
  const [gridSize, setGridSize] = useState(20);
  const [isRunning, setIsRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [aliveCells, setAliveCells] = useState(0);
  const [logicGrid, setLogicGrid] = useState<number[][][]>([]);
  const [visualGrid, setVisualGrid] = useState<VisualCell[][][]>([]);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Simulation parameters
  const [initialDensity, setInitialDensity] = useState(0.15);
  const [speed, setSpeed] = useState(300);
  const [birthRule, setBirthRule] = useState(5);
  const [survivalMin, setSurvivalMin] = useState(4);
  const [survivalMax, setSurvivalMax] = useState(6);

  // UI state
  const [showParams, setShowParams] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  const createEmptyGrids = useCallback((size: number) => {
    const logic = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() => Array(size).fill(0))
    );
    const visual = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() =>
        Array(size).fill(null).map(() => ({ scale: 0, age: 0 }))
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

  const updateVisualGrid = useCallback((newLogicGrid: number[][][], oldVisualGrid: VisualCell[][][]) => {
    const newVisualGrid = Array(gridSize).fill(null).map(() =>
      Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(null).map(() => ({ scale: 0, age: 0 }))
      )
    );

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const isAlive = newLogicGrid[x][y][z] === 1;
          const oldVisual = oldVisualGrid[x][y][z];

          if (isAlive) {
            // Alive cell
            const newAge = Math.min(oldVisual.age + 1, MAX_AGE);
            newVisualGrid[x][y][z] = { scale: 1, age: newAge };
          } else if (oldVisual.scale > 0.01) {
            // Fading dead cell
            const newScale = Math.max(0, oldVisual.scale - FADE_SPEED);
            newVisualGrid[x][y][z] = { scale: newScale, age: oldVisual.age };
          }
        }
      }
    }

    return newVisualGrid;
  }, [gridSize]);

  const stepSimulation = useCallback(() => {
    setLogicGrid(currentLogicGrid => {
      const newLogicGrid = createEmptyGrids(gridSize).logic;
      let newAliveCells = 0;

      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          for (let z = 0; z < gridSize; z++) {
            const neighbors = countNeighbors(currentLogicGrid, x, y, z);
            const isCurrentlyAlive = currentLogicGrid[x][y][z] === 1;

            if (isCurrentlyAlive) {
              // Survival rule
              if (neighbors >= survivalMin && neighbors <= survivalMax) {
                newLogicGrid[x][y][z] = 1;
                newAliveCells++;
              }
            } else {
              // Birth rule
              if (neighbors === birthRule) {
                newLogicGrid[x][y][z] = 1;
                newAliveCells++;
              }
            }
          }
        }
      }

      setAliveCells(newAliveCells);
      setGeneration(prev => prev + 1);

      // Update visual grid
      setVisualGrid(currentVisualGrid => 
        updateVisualGrid(newLogicGrid, currentVisualGrid)
      );

      return newLogicGrid;
    });
  }, [gridSize, countNeighbors, survivalMin, survivalMax, birthRule, createEmptyGrids, updateVisualGrid]);

  const toggleSimulation = useCallback(() => {
    if (isRunning) {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
      }
      setIsRunning(false);
    } else {
      setIsRunning(true);
      simulationInterval.current = setInterval(() => {
        stepSimulation();
      }, speed);
    }
  }, [isRunning, speed, stepSimulation]);

  // Initialize simulation
  useEffect(() => {
    resetSimulation(true);
  }, [resetSimulation]);

  // Update simulation speed when running
  useEffect(() => {
    if (isRunning && simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = setInterval(() => {
        stepSimulation();
      }, speed);
    }
  }, [speed, isRunning, stepSimulation]);

  // Reset simulation when grid size changes
  useEffect(() => {
    resetSimulation(true);
  }, [gridSize, resetSimulation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Canvas
        camera={{ position: [15, 15, 15], fov: 60 }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <SimulationGroup 
          gridSize={gridSize}
          logicGrid={logicGrid}
          visualGrid={visualGrid}
          isUserInteracting={isUserInteracting}
          setIsUserInteracting={setIsUserInteracting}
        />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          onStart={() => setIsUserInteracting(true)}
          onEnd={() => setIsUserInteracting(false)}
        />
      </Canvas>

      {/* Stats Overlay - Minimalist */}
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10 text-white font-mono text-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Gen</span>
            <span className="text-blue-400">{generation}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Live</span>
            <span className="text-green-400">{aliveCells}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Grid</span>
            <span className="text-purple-400">{gridSize}³</span>
          </div>
        </div>
      </div>

      {/* Main Controls - Floating Action Bar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center space-x-3 bg-black/70 backdrop-blur-md rounded-full px-4 py-3 border border-white/10 shadow-2xl">
          <button
            onClick={toggleSimulation}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-200 transform hover:scale-110 ${
              isRunning 
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
            }`}
            title={isRunning ? "Pause" : "Play"}
          >
            {isRunning ? "⏸" : "▶"}
          </button>
          
          <button
            onClick={stepSimulation}
            disabled={isRunning}
            className="w-12 h-12 rounded-full bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-500/10 disabled:text-gray-600 text-blue-400 flex items-center justify-center text-2xl transition-all duration-200 transform hover:scale-110 disabled:hover:scale-100"
            title="Step Forward"
          >
            ⏭
          </button>
          
          <div className="w-px h-8 bg-white/20"></div>
          
          <button
            onClick={() => resetSimulation(true)}
            className="w-12 h-12 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 flex items-center justify-center text-2xl transition-all duration-200 transform hover:scale-110"
            title="Randomize"
          >
            🎲
          </button>
          
          <button
            onClick={clearSimulation}
            className="w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center text-2xl transition-all duration-200 transform hover:scale-110"
            title="Clear All"
          >
            🗑
          </button>
          
          <div className="w-px h-8 bg-white/20"></div>
          
          <button
            onClick={() => setShowParams(!showParams)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-200 transform hover:scale-110 ${
              showParams 
                ? 'bg-purple-500/30 text-purple-300' 
                : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
            }`}
            title="Parameters"
          >
            ⚙
          </button>
          
          <button
            onClick={() => setShowRules(!showRules)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-200 transform hover:scale-110 ${
              showRules 
                ? 'bg-indigo-500/30 text-indigo-300' 
                : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400'
            }`}
            title="Rules"
          >
            📏
          </button>
        </div>
      </div>

      {/* Parameters Panel - Sleek Design */}
      {showParams && (
        <div className="absolute bottom-24 left-6 z-10 w-80 bg-black/80 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <span>⚙</span>
              <span>Parameters</span>
            </h3>
            <button
              onClick={() => setShowParams(false)}
              className="text-gray-400 hover:text-white transition-colors w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-3 flex items-center justify-between">
                <span>Grid Size</span>
                <span className="font-mono text-sm bg-gray-700/50 rounded-lg px-3 py-1 text-purple-400">
                  {gridSize}³
                </span>
              </label>
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
                className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-3 flex items-center justify-between">
                <span>Initial Density</span>
                <span className="font-mono text-sm bg-gray-700/50 rounded-lg px-3 py-1 text-green-400">
                  {(initialDensity * 100).toFixed(0)}%
                </span>
              </label>
              <input 
                type="range" 
                min="0.01" 
                max="0.5" 
                step="0.01"
                value={initialDensity}
                onChange={(e) => setInitialDensity(parseFloat(e.target.value))}
                className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-3 flex items-center justify-between">
                <span>Speed</span>
                <span className="font-mono text-sm bg-gray-700/50 rounded-lg px-3 py-1 text-blue-400">
                  {1050 - speed}ms
                </span>
              </label>
              <input 
                type="range" 
                min="50" 
                max="1000" 
                step="10"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      )}

      {/* Rules Panel - Sleek Design */}
      {showRules && (
        <div className="absolute bottom-24 right-6 z-10 w-80 bg-black/80 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <span>📏</span>
              <span>Rules</span>
            </h3>
            <button
              onClick={() => setShowRules(false)}
              className="text-gray-400 hover:text-white transition-colors w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 bg-indigo-500/20 rounded-lg px-3 py-2">
                <span className="text-indigo-400 text-sm">🌐</span>
                <span className="text-sm text-indigo-300">Periodic Boundaries</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-3 flex items-center justify-between">
                <span>Birth Neighbors</span>
                <span className="font-mono text-sm bg-gray-700/50 rounded-lg px-3 py-1 text-green-400">
                  {birthRule}
                </span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="26" 
                value={birthRule}
                onChange={(e) => setBirthRule(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-3">Survival Range</label>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Minimum</span>
                    <span className="font-mono text-sm bg-gray-700/50 rounded-lg px-3 py-1 text-yellow-400">
                      {survivalMin}
                    </span>
                  </div>
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
                    className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Maximum</span>
                    <span className="font-mono text-sm bg-gray-700/50 rounded-lg px-3 py-1 text-orange-400">
                      {survivalMax}
                    </span>
                  </div>
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
                    className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        @keyframes slide-in-from-bottom-4 {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .slide-in-from-bottom-4 {
          animation-name: slide-in-from-bottom-4;
        }
        
        .duration-300 {
          animation-duration: 300ms;
        }
      `}</style>
    </div>
  );
}
