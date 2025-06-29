'use client';

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function TestCube() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

export default function OverlayTest() {
  const [clickCount, setClickCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  const handleButtonClick = () => {
    console.log('Button clicked!', clickCount + 1);
    setClickCount(prev => prev + 1);
  };

  const handlePanelToggle = () => {
    console.log('Panel toggle clicked!');
    setShowPanel(prev => !prev);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'black' }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [5, 5, 5], fov: 60 }}
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0,
          zIndex: 1
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <TestCube />
        <OrbitControls />
      </Canvas>

      {/* Test Overlay 1 - Simple Button */}
      <div 
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          pointerEvents: 'auto',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          borderRadius: '8px',
          color: 'black'
        }}
      >
        <h3>Overlay Test</h3>
        <button 
          onClick={handleButtonClick}
          style={{
            background: 'blue',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        >
          Click Me! ({clickCount})
        </button>
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={handlePanelToggle}
            style={{
              background: 'green',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            Toggle Panel
          </button>
        </div>
      </div>

      {/* Test Overlay 2 - Floating Panel */}
      {showPanel && (
        <div 
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            pointerEvents: 'auto',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '12px',
            width: '300px'
          }}
        >
          <h4>Test Panel</h4>
          <div style={{ marginBottom: '10px' }}>
            <label>Test Slider:</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              defaultValue="50"
              style={{
                width: '100%',
                pointerEvents: 'auto'
              }}
              onChange={(e) => console.log('Slider value:', e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowPanel(false)}
            style={{
              background: 'red',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            Close Panel
          </button>
        </div>
      )}

      {/* Debug Info */}
      <div 
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          pointerEvents: 'none',
          background: 'rgba(255, 0, 0, 0.1)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px'
        }}
      >
        Debug: Clicks = {clickCount}, Panel = {showPanel ? 'Open' : 'Closed'}
      </div>
    </div>
  );
}
