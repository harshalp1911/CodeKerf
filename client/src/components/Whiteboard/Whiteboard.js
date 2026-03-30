import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

const Whiteboard = ({ socket, roomId, role }) => {
  const canvasRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [currentTool, setCurrentTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);

  const isViewer = role === 'viewer';

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: !isViewer && currentTool === 'pencil',
      width: canvasRef.current.parentElement.clientWidth,
      height: canvasRef.current.parentElement.clientHeight,
      backgroundColor: '#ffffff'
    });

    // Configure drawing brush
    fabricCanvas.freeDrawingBrush.color = color;
    fabricCanvas.freeDrawingBrush.width = strokeWidth;

    setCanvas(fabricCanvas);

    // Handle window resize
    const handleResize = () => {
      if (fabricCanvas && canvasRef.current && canvasRef.current.parentElement) {
        fabricCanvas.setDimensions({
          width: canvasRef.current.parentElement.clientWidth,
          height: canvasRef.current.parentElement.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      fabricCanvas.dispose();
    };
  }, []);

  // Handle tool changes
  useEffect(() => {
    if (!canvas || isViewer) return;

    canvas.isDrawingMode = currentTool === 'pencil';
    
    if (currentTool === 'pencil') {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = parseInt(strokeWidth, 10);
    }
  }, [canvas, currentTool, color, strokeWidth, isViewer]);

  // Handle socket events
  useEffect(() => {
    if (!socket || !canvas) return;

    // Listen for incoming drawings
    socket.on('whiteboardUpdate', (elementData) => {
      fabric.util.enlivenedObjects([elementData], (objects) => {
        const obj = objects[0];
        // Don't trigger events for remote updates
        canvas.add(obj);
        canvas.renderAll();
      });
    });

    socket.on('whiteboardCleared', () => {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
    });

    // Listen for local drawing
    canvas.on('path:created', (e) => {
      if (isViewer) return;
      const path = e.path;
      socket.emit('whiteboardDraw', { roomId, element: path.toJSON() });
    });

    canvas.on('object:added', (e) => {
      // We only care about objects added by the user, not ones loaded from remote
      if (isViewer || currentTool === 'pencil') return; 
      
      const obj = e.target;
      if (!obj.isFromRemote) {
        socket.emit('whiteboardDraw', { roomId, element: obj.toJSON() });
      }
    });

    return () => {
      socket.off('whiteboardUpdate');
      socket.off('whiteboardCleared');
      canvas.off('path:created');
      canvas.off('object:added');
    };
  }, [socket, canvas, roomId, isViewer, currentTool]);

  // Handle adding shapes
  const addShape = (type) => {
    if (!canvas || isViewer) return;

    let shape;
    const center = canvas.getCenter();

    switch (type) {
      case 'rect':
        shape = new fabric.Rect({
          left: center.left, top: center.top,
          fill: 'transparent', stroke: color, strokeWidth: parseInt(strokeWidth, 10),
          width: 100, height: 100, originX: 'center', originY: 'center'
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          left: center.left, top: center.top,
          fill: 'transparent', stroke: color, strokeWidth: parseInt(strokeWidth, 10),
          radius: 50, originX: 'center', originY: 'center'
        });
        break;
      case 'triangle':
        shape = new fabric.Triangle({
          left: center.left, top: center.top,
          fill: 'transparent', stroke: color, strokeWidth: parseInt(strokeWidth, 10),
          width: 100, height: 100, originX: 'center', originY: 'center'
        });
        break;
      case 'line':
        shape = new fabric.Line([50, 50, 200, 50], {
          left: center.left, top: center.top,
          stroke: color, strokeWidth: parseInt(strokeWidth, 10),
          originX: 'center', originY: 'center'
        });
        break;
      default: return;
    }

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      socket.emit('whiteboardDraw', { roomId, element: shape.toJSON() });
    }
  };

  const clearCanvas = () => {
    if (!canvas || isViewer) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    socket.emit('whiteboardClear', { roomId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '10px', 
        background: 'var(--header)', 
        borderBottom: '1px solid var(--border)',
        display: 'flex', 
        gap: '15px',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            disabled={isViewer}
            onClick={() => setCurrentTool('pencil')}
            style={{ padding: '6px 12px', background: currentTool === 'pencil' ? 'var(--btn)' : '#fff', color: currentTool === 'pencil' ? '#fff' : '#000', border: '1px solid #ccc' }}
          >
            Pencil
          </button>
          <button disabled={isViewer} onClick={() => setCurrentTool('select')} style={{ padding: '6px 12px', background: currentTool === 'select' ? 'var(--btn)' : '#fff', color: currentTool === 'select' ? '#fff' : '#000', border: '1px solid #ccc' }}>Select</button>
          <button disabled={isViewer} onClick={() => addShape('rect')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ccc' }}>▭</button>
          <button disabled={isViewer} onClick={() => addShape('circle')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ccc' }}>〇</button>
          <button disabled={isViewer} onClick={() => addShape('triangle')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ccc' }}>△</button>
          <button disabled={isViewer} onClick={() => addShape('line')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ccc' }}>—</button>
        </div>

        <div style={{ width: '1px', height: '24px', background: '#ccc' }}></div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            disabled={isViewer}
            style={{ cursor: isViewer ? 'not-allowed' : 'pointer' }}
          />
          <select 
            value={strokeWidth} 
            onChange={(e) => setStrokeWidth(e.target.value)}
            disabled={isViewer}
          >
            <option value="2">Thin</option>
            <option value="5">Medium</option>
            <option value="10">Thick</option>
          </select>
        </div>

        <div style={{ width: '1px', height: '24px', background: '#ccc' }}></div>

        <button 
          disabled={isViewer} 
          onClick={clearCanvas}
          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid red', color: 'red', cursor: isViewer ? 'not-allowed' : 'pointer' }}
        >
          Clear
        </button>
        
        {isViewer && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>View Only</span>}
      </div>

      {/* Canvas Container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default Whiteboard;
