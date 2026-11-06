import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import {
  PencilIcon, EraserIcon, CursorIcon, TextIcon,
  RectIcon, CircleIcon, TriangleIcon, LineIcon, TrashIcon
} from './WhiteboardIcons';

const TOOLS = [
  { id: 'pencil',   icon: PencilIcon,   title: 'Pencil' },
  { id: 'eraser',   icon: EraserIcon,   title: 'Eraser' },
  { id: 'select',   icon: CursorIcon,   title: 'Select / Delete' },
  { id: 'text',     icon: TextIcon,     title: 'Text' },
  { id: 'rect',     icon: RectIcon,     title: 'Rectangle' },
  { id: 'circle',   icon: CircleIcon,   title: 'Circle' },
  { id: 'triangle', icon: TriangleIcon, title: 'Triangle' },
  { id: 'line',     icon: LineIcon,     title: 'Line' },
];

const COLORS = ['#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

// Every object gets a stable id so edits and deletes reach the same object for everyone
const withId = (obj) => {
  if (!obj.id) obj.id = uuidv4();
  return obj;
};
const serialize = (obj) => obj.toJSON(['id']);

const Whiteboard = ({ socket, roomId, role, joinState }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [currentTool, setCurrentTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [eraserSize, setEraserSize] = useState(30);
  const [remotePointers, setRemotePointers] = useState([]); // {userId, userName, x, y, color}
  const pointerDebounceRef = useRef(null);

  const isViewer = role === 'viewer';

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: !isViewer && currentTool === 'pencil',
      width: w,
      height: h,
      backgroundColor: '#ffffff'
    });

    fabricCanvas.freeDrawingBrush.color = color;
    fabricCanvas.freeDrawingBrush.width = strokeWidth;

    setCanvas(fabricCanvas);

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        fabricCanvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
        fabricCanvas.renderAll();
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      fabricCanvas.dispose();
    };
  }, []);

  // Remove an object locally and tell everyone else
  const removeObject = useCallback((obj) => {
    if (!canvas || !obj) return;
    canvas.remove(obj);
    canvas.renderAll();
    if (obj.id) socket?.emit('whiteboardObjectRemoved', { roomId, id: obj.id });
  }, [canvas, socket, roomId]);

  // Viewers can see the board but not draw on, select or move anything
  useEffect(() => {
    if (!canvas) return;
    // Moving a multi-object selection can't be synced yet, so only allow one object at a time
    canvas.selection = false;
    canvas.skipTargetFind = isViewer;
    if (isViewer) {
      canvas.isDrawingMode = false;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, [canvas, isViewer]);

  // Handle tool changes
  useEffect(() => {
    if (!canvas || isViewer) return;

    const isEraser = currentTool === 'eraser';

    if (currentTool === 'pencil') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = parseInt(strokeWidth, 10);
    } else {
      canvas.isDrawingMode = false;
    }

    // While erasing, objects can't be grabbed or moved; the eraser does its own hit testing
    canvas.skipTargetFind = isEraser;
    canvas.defaultCursor = isEraser ? 'crosshair' : 'default';
    if (isEraser) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }

    // Stroke eraser: dragging over an object deletes the whole object for everyone. The old eraser
    // painted white on top, which left the original strokes on the board, still selectable.
    const radius = Math.round(parseInt(eraserSize, 10) / 2);
    let lastPoint = null; // set while the mouse is held down
    const eraseAt = (pointer) => {
      const nearBox = (obj) => {
        const box = obj.getBoundingRect();
        return pointer.x >= box.left - radius && pointer.x <= box.left + box.width + radius &&
          pointer.y >= box.top - radius && pointer.y <= box.top + box.height + radius;
      };
      // Check the actual pixels so passing through the empty corner of a curve's box doesn't erase it
      canvas.targetFindTolerance = radius;
      const hits = canvas.getObjects().filter(obj =>
        nearBox(obj) && !canvas.isTargetTransparent(obj, pointer.x, pointer.y)
      );
      canvas.targetFindTolerance = 0;
      hits.forEach(removeObject);
    };
    const handleEraseStart = (e) => {
      if (!isEraser) return;
      lastPoint = canvas.getPointer(e.e, true);
      eraseAt(lastPoint);
    };
    // Mouse events arrive in jumps when moving fast, so check points along the whole path
    // between them; otherwise a quick swipe could skip right over a thin line
    const handleEraseMove = (e) => {
      if (!lastPoint) return;
      const point = canvas.getPointer(e.e, true);
      const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(2, radius / 2)));
      for (let i = 1; i <= steps; i++) {
        eraseAt({
          x: lastPoint.x + ((point.x - lastPoint.x) * i) / steps,
          y: lastPoint.y + ((point.y - lastPoint.y) * i) / steps
        });
      }
      lastPoint = point;
    };
    const handleEraseEnd = () => {
      lastPoint = null;
    };

    // Emit drawing paths when user draws
    const handlePathCreated = (e) => {
      if (!socket) return;
      socket.emit('whiteboardDraw', { roomId, element: serialize(withId(e.path)) });
    };

    // Emit object modifications (text editing, moving, scaling). Fabric only fires this for the
    // local user's own actions, so applying remote updates never echoes back to the server.
    const handleObjectModified = (e) => {
      if (!socket || !e.target?.id) return;
      socket.emit('whiteboardObjectModified', { roomId, element: serialize(e.target) });
    };

    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('mouse:down', handleEraseStart);
    canvas.on('mouse:move', handleEraseMove);
    canvas.on('mouse:up', handleEraseEnd);

    // Delete selected object on keypress (select mode only, not while editing text)
    const handleKey = (e) => {
      // Don't intercept keys if a text object is being edited
      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.isEditing) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && currentTool === 'select') {
        removeObject(activeObj);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('mouse:down', handleEraseStart);
      canvas.off('mouse:move', handleEraseMove);
      canvas.off('mouse:up', handleEraseEnd);
      document.removeEventListener('keydown', handleKey);
    };
  }, [canvas, currentTool, color, strokeWidth, eraserSize, isViewer, socket, roomId, removeObject]);

  // Click-to-delete in select mode
  useEffect(() => {
    if (!canvas || isViewer) return;
    const handleDblClick = () => {
      if (currentTool !== 'select') return;
      const active = canvas.getActiveObject();
      // Don't delete text objects on double-click (user may want to edit them)
      if (active && !active.isEditing && active.type !== 'i-text') {
        removeObject(active);
      }
    };
    canvas.on('mouse:dblclick', handleDblClick);
    return () => canvas.off('mouse:dblclick', handleDblClick);
  }, [canvas, currentTool, isViewer, removeObject]);

  // Track mouse movement on whiteboard
  useEffect(() => {
    if (!canvas || !socket || isViewer) return;

    const handleMouseMove = (e) => {
      const pointer = canvas.getPointer(e.e);

      if (pointerDebounceRef.current) clearTimeout(pointerDebounceRef.current);
      pointerDebounceRef.current = setTimeout(() => {
        socket.emit('whiteboardPointer', {
          roomId,
          x: pointer.x,
          y: pointer.y
        });
      }, 50);
    };

    canvas.on('mouse:move', handleMouseMove);
    return () => canvas.off('mouse:move', handleMouseMove);
  }, [canvas, socket, roomId, isViewer]);

  // Load the saved board when it opens, and again after every (re)join so nothing missed while
  // the board was closed or the connection was down is lost
  useEffect(() => {
    if (!socket || !canvas || !joinState) return;

    socket.emit('getWhiteboard', { roomId }, ({ elements, error } = {}) => {
      if (error || !elements) return;
      fabric.util.enlivenObjects(elements, (objects) => {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        objects.forEach(obj => canvas.add(obj));
        canvas.renderAll();
      });
    });
  }, [socket, canvas, roomId, joinState]);

  // Handle socket events
  useEffect(() => {
    if (!socket || !canvas) return;

    const findById = (id) => canvas.getObjects().find(obj => obj.id === id);

    // Remote pointer tracking
    const handlePointerMove = ({ userId, userName, x, y, color }) => {
      setRemotePointers(prev => {
        const existing = prev.find(p => p.userId === userId);
        if (existing) {
          return prev.map(p => p.userId === userId ? { userId, userName, x, y, color } : p);
        }
        return [...prev, { userId, userName, x, y, color }];
      });

      // Auto-remove pointer after 3 seconds of inactivity
      setTimeout(() => {
        setRemotePointers(prev => prev.filter(p => p.userId !== userId));
      }, 3000);
    };

    const handleUpdate = (element) => {
      fabric.util.enlivenObjects([element], ([obj]) => {
        // Skip objects we already have, e.g. if the board finished loading after this was sent
        if (!obj || findById(obj.id)) return;
        canvas.add(obj);
        canvas.renderAll();
      });
    };

    // Replace the object with the same id, keeping its place in the stacking order
    const handleModified = ({ element }) => {
      fabric.util.enlivenObjects([element], ([obj]) => {
        if (!obj) return;
        const existing = findById(element.id);
        if (existing) {
          const index = canvas.getObjects().indexOf(existing);
          canvas.remove(existing);
          canvas.insertAt(obj, index);
        } else {
          canvas.add(obj);
        }
        canvas.renderAll();
      });
    };

    const handleRemoved = ({ id }) => {
      const existing = findById(id);
      if (!existing) return;
      canvas.remove(existing);
      canvas.renderAll();
    };

    const handleCleared = () => {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
    };

    socket.on('whiteboardPointerMove', handlePointerMove);
    socket.on('whiteboardUpdate', handleUpdate);
    socket.on('whiteboardObjectModified', handleModified);
    socket.on('whiteboardObjectRemoved', handleRemoved);
    socket.on('whiteboardCleared', handleCleared);

    return () => {
      socket.off('whiteboardPointerMove', handlePointerMove);
      socket.off('whiteboardUpdate', handleUpdate);
      socket.off('whiteboardObjectModified', handleModified);
      socket.off('whiteboardObjectRemoved', handleRemoved);
      socket.off('whiteboardCleared', handleCleared);
    };
  }, [socket, canvas]);

  // Add text box on canvas click (text mode)
  useEffect(() => {
    if (!canvas || currentTool !== 'text' || isViewer) return;

    const handleClick = (opt) => {
      const pointer = canvas.getPointer(opt.e);
      const textbox = withId(new fabric.IText('Type here', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 18,
        fill: color,
        fontFamily: 'sans-serif',
        editable: true
      }));
      canvas.add(textbox);
      canvas.setActiveObject(textbox);
      textbox.enterEditing();
      socket?.emit('whiteboardDraw', { roomId, element: serialize(textbox) });
      setCurrentTool('select');
    };
    canvas.on('mouse:down', handleClick);
    return () => canvas.off('mouse:down', handleClick);
  }, [canvas, currentTool, color, isViewer, roomId, socket]);

  // Add shapes
  const addShape = (type) => {
    if (!canvas || isViewer) return;
    let shape;
    const center = canvas.getCenter();
    const sw = parseInt(strokeWidth, 10);

    switch (type) {
      case 'rect':
        shape = new fabric.Rect({ left: center.left, top: center.top, fill: 'transparent', stroke: color, strokeWidth: sw, width: 100, height: 100, originX: 'center', originY: 'center' });
        break;
      case 'circle':
        shape = new fabric.Circle({ left: center.left, top: center.top, fill: 'transparent', stroke: color, strokeWidth: sw, radius: 50, originX: 'center', originY: 'center' });
        break;
      case 'triangle':
        shape = new fabric.Triangle({ left: center.left, top: center.top, fill: 'transparent', stroke: color, strokeWidth: sw, width: 100, height: 100, originX: 'center', originY: 'center' });
        break;
      case 'line':
        shape = new fabric.Line([50, 50, 200, 50], { left: center.left, top: center.top, stroke: color, strokeWidth: sw, originX: 'center', originY: 'center' });
        break;
      default: return;
    }
    withId(shape);
    canvas.add(shape);
    canvas.setActiveObject(shape);
    socket?.emit('whiteboardDraw', { roomId, element: serialize(shape) });
  };

  const clearCanvas = () => {
    if (!canvas || isViewer) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    socket?.emit('whiteboardClear', { roomId });
  };

  const handleToolClick = (toolId) => {
    if (isViewer) return;
    if (['rect', 'circle', 'triangle', 'line'].includes(toolId)) {
      addShape(toolId);
    } else {
      setCurrentTool(toolId);
    }
  };

  const btnStyle = (active) => ({
    padding: '4px 8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: isViewer ? 'not-allowed' : 'pointer',
    background: active ? 'var(--btn)' : 'var(--pane)',
    color: active ? '#fff' : 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    opacity: isViewer ? 0.4 : 1
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Toolbar */}
      <div style={{
        padding: '6px 10px',
        background: 'var(--header)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        flexWrap: 'wrap',
        minHeight: '40px'
      }}>
        {/* Tools */}
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = currentTool === tool.id && !['rect','circle','triangle','line'].includes(tool.id);
          return (
            <button
              key={tool.id}
              disabled={isViewer}
              onClick={() => handleToolClick(tool.id)}
              style={btnStyle(isActive)}
              title={tool.title}
            >
              <Icon size={16} color={isActive ? '#fff' : 'var(--text)'} />
            </button>
          );
        })}

        <div style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 2px' }} />

        {/* Colors */}
        {COLORS.map(c => (
          <button
            key={c}
            disabled={isViewer}
            onClick={() => setColor(c)}
            style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: c, border: color === c ? '2px solid var(--btn)' : '1px solid var(--border)',
              cursor: isViewer ? 'not-allowed' : 'pointer', padding: 0,
              boxShadow: color === c ? '0 0 0 2px var(--bg)' : 'none'
            }}
            title={c}
          />
        ))}

        <div style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 2px' }} />

        {/* Stroke width */}
        <select
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(e.target.value)}
          disabled={isViewer}
          style={{
            padding: '3px 6px', fontSize: '12px',
            background: 'var(--pane)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: '3px'
          }}
        >
          <option value="2">Thin</option>
          <option value="5">Medium</option>
          <option value="10">Thick</option>
        </select>

        {/* Eraser size (only visible when eraser active) */}
        {currentTool === 'eraser' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.6 }}>Eraser:</span>
            <input
              type="range"
              min="10" max="80" value={eraserSize}
              onChange={(e) => setEraserSize(e.target.value)}
              style={{ width: '70px', cursor: 'pointer' }}
            />
            <span style={{
              width: `${Math.min(eraserSize * 0.5, 28)}px`, height: `${Math.min(eraserSize * 0.5, 28)}px`,
              borderRadius: '50%', border: '2px solid var(--text)', opacity: 0.4, flexShrink: 0
            }} />
          </div>
        )}

        {/* Clear */}
        <button
          disabled={isViewer}
          onClick={clearCanvas}
          style={{
            ...btnStyle(false),
            color: '#ef4444',
            borderColor: '#ef4444',
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}
          title="Clear canvas"
        >
          <TrashIcon size={14} color="#ef4444" /> Clear
        </button>

        {isViewer && <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.5 }}>View Only</span>}
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} />
      
      {/* Remote pointer indicators */}
      {remotePointers.map(pointer => (
        <div
          key={pointer.userId}
          style={{
            position: 'absolute',
            left: `${pointer.x}px`,
            top: `${pointer.y}px`,
            pointerEvents: 'none',
            zIndex: 1000,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: pointer.color,
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: pointer.color,
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {pointer.userName.split(' ')[0]}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};

export default Whiteboard;
