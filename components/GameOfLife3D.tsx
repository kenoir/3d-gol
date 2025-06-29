'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GameOfLife3D as GameEngine, type GameOfLife3DConfig, type Grid3D } from '../lib/gameOfLife3D';

interface VisualCell {
  scale: number;
  age: number;
  targetScale: number;
  fadeState: 'appearing' | 'stable' | 'disappearing';
}

const MAX_AGE = 15;
const FADE_IN_SPEED = 0.08;
const FADE_OUT_SPEED = 0.12;
const SCALE_TRANSITION_SPEED = 0.1;

// Hook for smooth visual grid animations
function useAnimatedVisualGrid(visualGrid: VisualCell[][][], gridSize: number) {
  const [animatedGrid, setAnimatedGrid] = useState<VisualCell[][][]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    // Initialize animatedGrid when visualGrid becomes available
    if (visualGrid.length > 0 && animatedGrid.length === 0) {
      setAnimatedGrid(visualGrid);
      return;
    }

    // Safety check: ensure visualGrid is properly initialized
    if (!visualGrid.length || !visualGrid[0] || visualGrid.length !== gridSize) {
      return;
    }

    const animate = () => {
      setAnimatedGrid(currentGrid => {
        // Additional safety check within animation
        if (!currentGrid.length || !visualGrid.length) {
          return currentGrid;
        }

        const newGrid = currentGrid.map((xSlice, x) =>
          xSlice.map((ySlice, y) =>
            ySlice.map((visual, z) => {
              const targetVisual = visualGrid[x]?.[y]?.[z];
              if (!targetVisual) return visual;

              let newScale = visual.scale;
              let newFadeState = visual.fadeState;

              // Smooth transition for appearing cells
              if (targetVisual.fadeState === 'appearing' && visual.scale < targetVisual.targetScale) {
                newScale = Math.min(targetVisual.targetScale, visual.scale + SCALE_TRANSITION_SPEED);
                newFadeState = newScale >= 0.95 ? 'stable' : 'appearing';
              }
              // Smooth transition for disappearing cells
              else if (targetVisual.fadeState === 'disappearing' && visual.scale > targetVisual.targetScale) {
                newScale = Math.max(targetVisual.targetScale, visual.scale - SCALE_TRANSITION_SPEED);
                newFadeState = 'disappearing';
              }
              // Update to match target immediately for stable cells
              else if (targetVisual.fadeState === 'stable') {
                newScale = targetVisual.scale;
                newFadeState = targetVisual.fadeState;
              }
              // Copy other values from target
              else {
                newScale = targetVisual.scale;
                newFadeState = targetVisual.fadeState;
              }

              return {
                ...targetVisual,
                scale: newScale,
                fadeState: newFadeState
              };
            })
          )
        );

        // Check if animation should continue
        const hasActiveAnimations = newGrid.some((xSlice, x) =>
          xSlice.some((ySlice, y) =>
            ySlice.some((visual, z) => {
              const target = visualGrid[x]?.[y]?.[z];
              return target && (
                (visual.fadeState === 'appearing' && visual.scale < 0.95) ||
                (visual.fadeState === 'disappearing' && visual.scale > 0.01)
              );
            })
          )
        );

        if (hasActiveAnimations) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }

        return newGrid;
      });
    };

    // Start animation if there are transitions to animate
    const hasTransitions = visualGrid.some((xSlice, x) =>
      xSlice.some((ySlice, y) =>
        ySlice.some(visual => 
          visual.fadeState === 'appearing' || visual.fadeState === 'disappearing'
        )
      )
    );

    if (hasTransitions && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [visualGrid, gridSize]);

  useEffect(() => {
    setAnimatedGrid(visualGrid);
  }, [visualGrid]);

  return animatedGrid;
}

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
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

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

    // Safety check: ensure grids are properly initialized
    if (!logicGrid.length || !visualGrid.length || 
        !logicGrid[0] || !visualGrid[0] || 
        logicGrid.length !== gridSize || visualGrid.length !== gridSize) {
      return;
    }

    let instanceIndex = 0;
    let needsColorUpdate = false;
    let needsMatrixUpdate = false;
    const centerOffset = -(gridSize - 1) / 2;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const isAlive = logicGrid[x]?.[y]?.[z] === 1;
          const visual = visualGrid[x]?.[y]?.[z];

          if (!visual) continue;

          if (isAlive || visual.scale > 0.01) {
            // Update position
            tempObject.current.position.set(
              x + centerOffset,
              y + centerOffset,
              z + centerOffset
            );
            
            // Apply smooth easing to scale transition
            const easedScale = visual.fadeState === 'appearing' 
              ? visual.scale * visual.scale // Ease in quadratic
              : visual.fadeState === 'disappearing'
              ? visual.scale * visual.scale // Ease out quadratic
              : visual.scale;
            
            tempObject.current.scale.setScalar(easedScale);
            tempObject.current.updateMatrix();
            cellInstances.setMatrixAt(instanceIndex, tempObject.current.matrix);

            // Update color based on age and fade state
            const ageRatio = Math.min(visual.age / MAX_AGE, 1);
            const alphaMultiplier = visual.fadeState === 'appearing' ? visual.scale : 
                                   visual.fadeState === 'disappearing' ? visual.scale * 0.8 : 1;
            
            tempColor.current.setHSL(
              0.15 + ageRatio * 0.4, // Hue: yellow to cyan
              0.8 * alphaMultiplier,
              (0.3 + ageRatio * 0.4) * alphaMultiplier
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
  const [logicGrid, setLogicGrid] = useState<Grid3D>([]);
  const [visualGrid, setVisualGrid] = useState<VisualCell[][][]>([]);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Use visual grid directly for now to fix the rendering error
  // const animatedVisualGrid = useAnimatedVisualGrid(
  //   visualGrid.length > 0 ? visualGrid : [], 
  //   gridSize
  // );

  // Simulation parameters
  const [initialDensity, setInitialDensity] = useState(0.08);
  const [speed, setSpeed] = useState(300);
  const [birthRule, setBirthRule] = useState(4);
  const [survivalMin, setSurvivalMin] = useState(4);
  const [survivalMax, setSurvivalMax] = useState(5);

  // UI state
  const [showSettings, setShowSettings] = useState(false);

  const simulationInterval = useRef<NodeJS.Timeout | null>(null);
  const gameEngine = useRef<GameEngine | null>(null);

  // Initialize game engine
  useEffect(() => {
    const config: GameOfLife3DConfig = {
      gridSize,
      birthRule,
      survivalMin,
      survivalMax,
      periodicBoundaries: true
    };
    gameEngine.current = new GameEngine(config);
  }, [gridSize, birthRule, survivalMin, survivalMax]);

  const createEmptyGrids = useCallback((size: number) => {
    if (!gameEngine.current) return { logic: [], visual: [] };
    
    const logic = gameEngine.current.createEmptyGrid();
    const visual = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() =>
        Array(size).fill(null).map(() => ({ 
          scale: 0, 
          age: 0, 
          targetScale: 0, 
          fadeState: 'stable' as 'appearing' | 'stable' | 'disappearing'
        }))
      )
    );
    return { logic, visual };
  }, []);

  const resetSimulation = useCallback((randomize = true) => {
    if (!gameEngine.current) return;
    
    setIsUserInteracting(false);
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    setIsRunning(false);
    setGeneration(0);
    setAliveCells(0);

    const { visual } = createEmptyGrids(gridSize);
    let logic: Grid3D;
    
    if (randomize) {
      logic = gameEngine.current.createRandomGrid(initialDensity);
      const liveCount = gameEngine.current.countLivingCells(logic);
      setAliveCells(liveCount);
      
      // Update visual grid to match logic grid
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          for (let z = 0; z < gridSize; z++) {
            if (logic[x][y][z] === 1) {
              visual[x][y][z] = { 
                scale: 1, 
                age: 1, 
                targetScale: 1, 
                fadeState: 'stable' 
              };
            }
          }
        }
      }
    } else {
      logic = gameEngine.current.createEmptyGrid();
    }
    
    setLogicGrid(logic);
    setVisualGrid(visual);
  }, [gridSize, initialDensity, createEmptyGrids]);

  const clearSimulation = useCallback(() => {
    resetSimulation(false);
  }, [resetSimulation]);

  const updateVisualGrid = useCallback((newLogicGrid: Grid3D, oldVisualGrid: VisualCell[][][]) => {
    const newVisualGrid = Array(gridSize).fill(null).map(() =>
      Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(null).map(() => ({ 
          scale: 0, 
          age: 0, 
          targetScale: 0, 
          fadeState: 'stable' as 'appearing' | 'stable' | 'disappearing'
        }))
      )
    );

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const isAlive = newLogicGrid[x][y][z] === 1;
          const oldVisual = oldVisualGrid[x][y][z];

          if (isAlive) {
            // Cell is alive
            const newAge = Math.min(oldVisual.age + 1, MAX_AGE);
            if (oldVisual.scale === 0) {
              // New cell - start fading in
              newVisualGrid[x][y][z] = { 
                scale: 0.1, 
                age: newAge, 
                targetScale: 1, 
                fadeState: 'appearing' 
              };
            } else {
              // Existing cell - continue or maintain
              newVisualGrid[x][y][z] = { 
                scale: Math.min(1, oldVisual.scale + FADE_IN_SPEED), 
                age: newAge, 
                targetScale: 1, 
                fadeState: oldVisual.fadeState === 'appearing' && oldVisual.scale < 0.95 ? 'appearing' : 'stable' 
              };
            }
          } else if (oldVisual.scale > 0.01) {
            // Cell is dead but still visible - fade out
            const newScale = Math.max(0, oldVisual.scale - FADE_OUT_SPEED);
            newVisualGrid[x][y][z] = { 
              scale: newScale, 
              age: oldVisual.age, 
              targetScale: 0, 
              fadeState: 'disappearing' 
            };
          }
        }
      }
    }

    return newVisualGrid;
  }, [gridSize]);

  const stepSimulation = useCallback(() => {
    if (!gameEngine.current) return;
    
    setLogicGrid(currentLogicGrid => {
      const newLogicGrid = gameEngine.current!.step(currentLogicGrid);
      const newAliveCells = gameEngine.current!.countLivingCells(newLogicGrid);

      setAliveCells(newAliveCells);
      setGeneration(prev => prev + 1);

      // Update visual grid
      setVisualGrid(currentVisualGrid => 
        updateVisualGrid(newLogicGrid, currentVisualGrid)
      );

      return newLogicGrid;
    });
  }, [updateVisualGrid]);

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
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, background: 'black', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [15, 15, 15], fov: 60 }}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
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
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: '8px',
        padding: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        pointerEvents: 'auto'
      }}>
        <div className="space-y-1">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#9CA3AF' }}>Gen</span>
            <span style={{ color: '#60A5FA' }}>{generation}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#9CA3AF' }}>Live</span>
            <span style={{ color: '#34D399' }}>{aliveCells}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#9CA3AF' }}>Grid</span>
            <span style={{ color: '#A78BFA' }}>{gridSize}³</span>
          </div>
        </div>
      </div>

      {/* Main Controls - Floating Action Bar */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: '90vw',
        pointerEvents: 'auto'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: '9999px',
          padding: '12px 16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <button
            onClick={toggleSimulation}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s',
              transform: 'scale(1)',
              background: isRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
              color: isRunning ? '#F87171' : '#4ADE80',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title={isRunning ? "Pause" : "Play"}
          >
            {isRunning ? "⏸" : "▶"}
          </button>
          
          <button
            onClick={stepSimulation}
            disabled={isRunning}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isRunning ? 'rgba(107, 114, 128, 0.1)' : 'rgba(59, 130, 246, 0.2)',
              color: isRunning ? '#6B7280' : '#60A5FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s',
              transform: 'scale(1)',
              border: 'none',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => !isRunning && (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={(e) => !isRunning && (e.currentTarget.style.transform = 'scale(1)')}
            title="Step Forward"
          >
            ⏭
          </button>
          
          <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
          
          <button
            onClick={() => resetSimulation(true)}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(234, 179, 8, 0.2)',
              color: '#FACC15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s',
              transform: 'scale(1)',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title="Randomize"
          >
            🎲
          </button>
          
          <button
            onClick={clearSimulation}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#F87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s',
              transform: 'scale(1)',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title="Clear All"
          >
            🗑
          </button>
          
          <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: showSettings ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.2)',
              color: showSettings ? '#C084FC' : '#A855F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s',
              transform: 'scale(1)',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Combined Settings Panel - Center Overlay */}
      {showSettings && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          background: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: 'white',
          pointerEvents: 'auto',
          overflow: 'auto'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>⚙</span>
              <span>Game Settings</span>
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                pointerEvents: 'auto',
                marginLeft: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#9CA3AF';
              }}
            >
              ✕
            </button>
          </div>

          {/* Content in two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            
            {/* Parameters Column */}
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: '#A855F7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📊</span>
                <span>Parameters</span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Grid Size */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>Grid Size</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', background: 'rgba(107, 114, 128, 0.5)', borderRadius: '8px', padding: '4px 12px', color: '#A855F7' }}>
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
                    style={{
                      width: '100%',
                      height: '12px',
                      background: 'rgba(107, 114, 128, 0.5)',
                      borderRadius: '8px',
                      appearance: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    }}
                  />
                </div>
                
                {/* Initial Density */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>Initial Density</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', background: 'rgba(107, 114, 128, 0.5)', borderRadius: '8px', padding: '4px 12px', color: '#34D399' }}>
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
                    style={{
                      width: '100%',
                      height: '12px',
                      background: 'rgba(107, 114, 128, 0.5)',
                      borderRadius: '8px',
                      appearance: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    }}
                  />
                </div>
                
                {/* Speed */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>Speed</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', background: 'rgba(107, 114, 128, 0.5)', borderRadius: '8px', padding: '4px 12px', color: '#60A5FA' }}>
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
                    style={{
                      width: '100%',
                      height: '12px',
                      background: 'rgba(107, 114, 128, 0.5)',
                      borderRadius: '8px',
                      appearance: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Rules Column */}
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: '#818CF8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📏</span>
                <span>Rules</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Periodic Boundaries Info */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '8px', padding: '8px 12px' }}>
                    <span style={{ color: '#818CF8', fontSize: '14px' }}>🌐</span>
                    <span style={{ fontSize: '14px', color: '#A5B4FC' }}>Periodic Boundaries</span>
                  </div>
                </div>
                
                {/* Birth Rule */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>Birth Neighbors</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', background: 'rgba(107, 114, 128, 0.5)', borderRadius: '8px', padding: '4px 12px', color: '#34D399' }}>
                      {birthRule}
                    </span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="26" 
                    value={birthRule}
                    onChange={(e) => setBirthRule(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: '12px',
                      background: 'rgba(107, 114, 128, 0.5)',
                      borderRadius: '8px',
                      appearance: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    }}
                  />
                </div>
                
                {/* Survival Range */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#D1D5DB', marginBottom: '12px', display: 'block' }}>Survival Range</label>
                  
                  {/* Minimum */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Minimum</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px', background: 'rgba(107, 114, 128, 0.5)', borderRadius: '8px', padding: '4px 12px', color: '#FACC15' }}>
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
                      style={{
                        width: '100%',
                        height: '12px',
                        background: 'rgba(107, 114, 128, 0.5)',
                        borderRadius: '8px',
                        appearance: 'none',
                        cursor: 'pointer',
                        pointerEvents: 'auto'
                      }}
                    />
                  </div>
                  
                  {/* Maximum */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Maximum</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px', background: 'rgba(107, 114, 128, 0.5)', borderRadius: '8px', padding: '4px 12px', color: '#FB923C' }}>
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
                      style={{
                        width: '100%',
                        height: '12px',
                        background: 'rgba(107, 114, 128, 0.5)',
                        borderRadius: '8px',
                        appearance: 'none',
                        cursor: 'pointer',
                        pointerEvents: 'auto'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
        }
        
        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        /* Ensure proper stacking and pointer events */
        canvas {
          pointer-events: auto;
        }
        
        /* Override any pointer-events: none on UI elements */
        button {
          pointer-events: auto !important;
        }
        
        input {
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
}
