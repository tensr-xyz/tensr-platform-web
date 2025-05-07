import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  LuArrowRight,
  LuCircle,
  LuMove,
  LuRotateCcw,
  LuRotateCw,
  LuSquare,
  LuMinus,
  LuPlus,
} from 'react-icons/lu';
import { SidebarTrigger, SidebarProvider, SidebarInset } from '@/components/organisms/sidebar';
import { useTabs } from '@/contexts/tabs-context';
import {
  ModelNode,
  PropertiesSidebar,
} from '@/components/templates/model-builder/properties-sidebar';

// Types
type NodeType = 'observed' | 'latent';
type ToolType = 'move' | 'observed' | 'latent' | 'path';

interface Point {
  x: number;
  y: number;
}

interface Node {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label: string;
  dataType?: string;
  statistics?: Record<string, number>;
}

interface Path {
  id: string;
  start: string;
  end: string;
  coefficient: string;
}

interface ViewportOffset {
  x: number;
  y: number;
}

interface HistoryState {
  nodes: Node[];
  paths: Path[];
}

interface ModelFitIndices {
  cfi: number;
  rmsea: number;
  srmr: number;
  // Add other indices as needed
}

interface GridProps {
  zoom: number;
  viewportOffset: ViewportOffset;
}

interface ModelFitIndices {
  cfi: number;
  rmsea: number;
  srmr: number;
}

// Constants
const GRID_SIZE = 20;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// Utility functions
const generateId = (): string => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const snapToGrid = (value: number): number => Math.round(value / GRID_SIZE) * GRID_SIZE;

export function ModelBuilder() {
  const { state } = useTabs();
  const activeTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
  );

  // State
  const [nodes, setNodes] = useState<Node[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [viewportOffset, setViewportOffset] = useState<ViewportOffset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState(true);
  const [selectedTool, setSelectedTool] = useState<ToolType>('move');
  const [drawing, setDrawing] = useState(false);
  const [startNode, setStartNode] = useState<Node | null>(null);
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [modelFitIndices, setModelFitIndices] = useState<ModelFitIndices | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 });

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });

  // Virtual list setup for large numbers of nodes
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(nodes.length / 3), // Assuming a grid layout
    getScrollElement: () => canvasRef.current,
    estimateSize: () => GRID_SIZE,
    overscan: 5,
  });

  // Save state to history
  const saveToHistory = useCallback(
    (newNodes: Node[], newPaths: Path[]) => {
      const newHistory = [
        ...history.slice(0, historyIndex + 1),
        { nodes: newNodes, paths: newPaths },
      ];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex]
  );

  // Undo/Redo handlers
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setPaths(prevState.paths);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setPaths(nextState.paths);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Canvas event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left mouse button
      if (selectedTool === 'move') {
        setIsPanning(true);
        setPanStart({
          x: e.clientX - viewportOffset.x,
          y: e.clientY - viewportOffset.y,
        });
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
        e.preventDefault();
        return;
      }

      if (selectedTool === 'observed' || selectedTool === 'latent') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = snapToGrid((e.clientX - rect.left - viewportOffset.x) / zoom);
        const y = snapToGrid((e.clientY - rect.top - viewportOffset.y) / zoom);

        const newNode: Node = {
          id: generateId(),
          x,
          y,
          type: selectedTool,
          label: `${selectedTool === 'observed' ? 'X' : 'F'}${nodes.length + 1}`,
        };

        const newNodes = [...nodes, newNode];
        setNodes(newNodes);
        saveToHistory(newNodes, paths);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    if (isPanning) {
      setViewportOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }

    if (draggedNode) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = snapToGrid((e.clientX - rect.left - dragOffset.x) / zoom);
      const y = snapToGrid((e.clientY - rect.top - dragOffset.y) / zoom);

      const updatedNodes = nodes.map(node =>
        node.id === draggedNode.id ? { ...node, x, y } : node
      );
      setNodes(updatedNodes);
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseUp = () => {
    if (draggedNode) {
      saveToHistory(nodes, paths);
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = selectedTool === 'move' ? 'grab' : 'default';
    }
    setIsPanning(false);
    setDraggedNode(null);
    setDrawing(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const newZoom = Math.min(Math.max(zoom + delta * 0.001, MIN_ZOOM), MAX_ZOOM);

      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setViewportOffset(prev => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
      }));

      setZoom(newZoom);
    }
  };

  // Node event handlers
  const handleNodeMouseDown = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    setSelectedNode(node);

    if (selectedTool === 'path') {
      setDrawing(true);
      setStartNode(node);
    } else if (selectedTool === 'move') {
      setDraggedNode(node);
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - node.x * zoom,
        y: e.clientY - rect.top - node.y * zoom,
      });
    }
  };

  const handleNodeMouseUp = (e: React.MouseEvent, endNode: Node) => {
    if (drawing && startNode && endNode && startNode.id !== endNode.id) {
      const newPath: Path = {
        id: generateId(),
        start: startNode.id,
        end: endNode.id,
        coefficient: '0.0',
      };
      const newPaths = [...paths, newPath];
      setPaths(newPaths);
      saveToHistory(nodes, newPaths);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // Add this effect to update viewport dimensions
  useEffect(() => {
    const updateViewportDimensions = () => {
      if (canvasRef.current) {
        setViewportDimensions({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight,
        });
      }
    };

    updateViewportDimensions();
    window.addEventListener('resize', updateViewportDimensions);

    return () => window.removeEventListener('resize', updateViewportDimensions);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) {
          const newNodes = nodes.filter(n => n.id !== selectedNode.id);
          const newPaths = paths.filter(
            p => p.start !== selectedNode.id && p.end !== selectedNode.id
          );
          setNodes(newNodes);
          setPaths(newPaths);
          saveToHistory(newNodes, newPaths);
          setSelectedNode(null);
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, paths, selectedNode, undo, redo]);

  const [availableVariables, setAvailableVariables] = useState<
    Array<{
      name: string;
      statistics: { mean: number; sd: number; n: number };
    }>
  >([]);

  // Calculate statistics for variables
  const calculateStatistics = useCallback((data: any[], variable: string) => {
    const values = data.map(row => parseFloat(row[variable])).filter(val => !isNaN(val));
    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return {
      mean,
      sd: Math.sqrt(variance),
      n: values.length,
    };
  }, []);

  // Update available variables when active tab changes
  useEffect(() => {
    if (activeTab?.data?.initialData) {
      const variables = Object.keys(activeTab.data.initialData[0] || {}).map(key => ({
        name: key,
        statistics: calculateStatistics(activeTab.data.initialData, key) || {
          mean: 0,
          sd: 0,
          n: 0,
        },
      }));
      setAvailableVariables(variables);
    }
  }, [activeTab?.data?.initialData, calculateStatistics]);

  // Components
  const FloatingControls = () => (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 flex gap-2 z-50">
      <div className="flex gap-2 border-r pr-2">
        <button
          className={`p-2 rounded-sm ${selectedTool === 'move' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          onClick={() => setSelectedTool('move')}
          title="Move Tool (V)"
        >
          <LuMove className="w-5 h-5" />
        </button>
        <button
          className={`p-2 rounded-sm ${selectedTool === 'observed' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          onClick={() => setSelectedTool('observed')}
          title="Observed Variable (O)"
        >
          <LuSquare className="w-5 h-5" />
        </button>
        <button
          className={`p-2 rounded-sm ${selectedTool === 'latent' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          onClick={() => setSelectedTool('latent')}
          title="Latent Variable (L)"
        >
          <LuCircle className="w-5 h-5" />
        </button>
        <button
          className={`p-2 rounded-sm ${selectedTool === 'path' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          onClick={() => setSelectedTool('path')}
          title="Add Path (P)"
        >
          <LuArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 border-r pr-2">
        <button
          className="p-2 rounded-sm hover:bg-gray-100"
          onClick={undo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
        >
          <LuRotateCcw className="w-5 h-5" />
        </button>
        <button
          className="p-2 rounded-sm hover:bg-gray-100"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Shift+Z)"
        >
          <LuRotateCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-sm hover:bg-gray-100"
          onClick={() => setZoom(z => Math.max(z - 0.1, MIN_ZOOM))}
          title="Zoom Out"
        >
          <LuMinus className="w-5 h-5" />
        </button>
        <span className="text-sm">{Math.round(zoom * 100)}%</span>
        <button
          className="p-2 rounded-sm hover:bg-gray-100"
          onClick={() => setZoom(z => Math.min(z + 0.1, MAX_ZOOM))}
          title="Zoom In"
        >
          <LuPlus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const Grid = ({ zoom, viewportOffset }: GridProps) => {
    const gridSize = GRID_SIZE * zoom;
    const smallGridSize = gridSize;
    const largeGridSize = gridSize * 5;

    // Calculate grid bounds based on viewport
    const startX = Math.floor(-viewportOffset.x / largeGridSize) * largeGridSize;
    const startY = Math.floor(-viewportOffset.y / largeGridSize) * largeGridSize;
    const endX = startX + viewportDimensions.width / zoom + largeGridSize * 2;
    const endY = startY + viewportDimensions.height / zoom + largeGridSize * 2;

    return (
      <svg
        className="absolute inset-0"
        style={{
          transform: `translate(${startX}px, ${startY}px)`,
          width: endX - startX,
          height: endY - startY,
        }}
      >
        <defs>
          <pattern
            id="smallGrid"
            width={smallGridSize}
            height={smallGridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${smallGridSize} 0 L 0 0 0 ${smallGridSize}`}
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="grid"
            width={largeGridSize}
            height={largeGridSize}
            patternUnits="userSpaceOnUse"
          >
            <rect width="100%" height="100%" fill="url(#smallGrid)" />
            <path
              d={`M ${largeGridSize} 0 L 0 0 0 ${largeGridSize}`}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    );
  };

  const renderNode = useCallback(
    (node: Node) => {
      const NodeComponent = node.type === 'observed' ? LuSquare : LuCircle;
      const isSelected = selectedNode?.id === node.id;

      // Only render nodes that are within the viewport
      const nodeX = node.x * zoom + viewportOffset.x;
      const nodeY = node.y * zoom + viewportOffset.y;

      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();

      if (nodeX < -100 || nodeX > rect.width + 100 || nodeY < -100 || nodeY > rect.height + 100) {
        return null;
      }

      return (
        <div
          key={node.id}
          className={`absolute cursor-move transform-gpu ${
            isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''
          }`}
          style={{
            left: node.x - 20,
            top: node.y - 20,
            transform: `scale(${1 / zoom})`,
          }}
          onMouseDown={e => handleNodeMouseDown(e, node)}
          onMouseUp={e => handleNodeMouseUp(e, node)}
        >
          <NodeComponent className="w-10 h-10" />
          {editingLabel === node.id ? (
            <input
              autoFocus
              className="absolute w-20 -ml-5 mt-1 text-sm text-center bg-white border rounded-sm"
              value={node.label}
              onChange={e => {
                const updatedNodes = nodes.map(n =>
                  n.id === node.id ? { ...n, label: e.target.value } : n
                );
                setNodes(updatedNodes);
              }}
              onBlur={() => {
                setEditingLabel(null);
                saveToHistory(nodes, paths);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setEditingLabel(null);
                  saveToHistory(nodes, paths);
                }
              }}
            />
          ) : (
            <div
              className="text-center mt-1 text-sm select-none"
              onDoubleClick={() => setEditingLabel(node.id)}
            >
              {node.label}
            </div>
          )}
        </div>
      );
    },
    [zoom, viewportOffset, selectedNode, editingLabel, nodes, paths]
  );

  const handleNodeUpdate = (updatedNode: ModelNode) => {
    setNodes(prevNodes => prevNodes.map(node => (node.id === updatedNode.id ? updatedNode : node)));
  };

  const renderPath = useCallback(
    (path: Path) => {
      const startNode = nodes.find(n => n.id === path.start);
      const endNode = nodes.find(n => n.id === path.end);
      if (!startNode || !endNode) return null;

      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const length = Math.sqrt(dx * dx + dy * dy);

      // Check if path is within viewport
      const pathCenterX = ((startNode.x + endNode.x) / 2) * zoom + viewportOffset.x;
      const pathCenterY = ((startNode.y + endNode.y) / 2) * zoom + viewportOffset.y;

      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();

      if (
        pathCenterX < -length ||
        pathCenterX > rect.width + length ||
        pathCenterY < -length ||
        pathCenterY > rect.height + length
      ) {
        return null;
      }

      return (
        <div
          key={path.id}
          className="absolute h-0.5 bg-black origin-left"
          style={{
            left: startNode.x,
            top: startNode.y,
            width: length,
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-y-3 -translate-x-1/2 bg-white px-1 text-sm select-none"
            style={{ transform: `rotate(${-angle}deg)` }}
          >
            {path.coefficient}
          </div>
        </div>
      );
    },
    [nodes, zoom, viewportOffset]
  );

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '18rem',
        } as React.CSSProperties
      }
    >
      {/* Properties Sidebar */}
      <PropertiesSidebar
        selectedNode={selectedNode}
        modelFitIndices={modelFitIndices}
        availableVariables={availableVariables}
        onNodeUpdate={handleNodeUpdate}
      />

      {/*<ErrorTermsPanel*/}
      {/*  nodes={nodes}*/}
      {/*  errorTerms={errorTerms}*/}
      {/*  errorCovariances={errorCovariances}*/}
      {/*  standardizedResiduals={standardizedResiduals}*/}
      {/*  onAddErrorTerm={handleAddErrorTerm}*/}
      {/*  onAddCovariance={handleAddCovariance}*/}
      {/*  onUpdateErrorTerm={term => {*/}
      {/*    setErrorTerms(prev => prev.map(t =>*/}
      {/*      t.id === term.id ? term : t*/}
      {/*    ));*/}
      {/*  }}*/}
      {/*  onUpdateCovariance={cov => {*/}
      {/*    setErrorCovariances(prev => prev.map(c =>*/}
      {/*      c.id === cov.id ? cov : c*/}
      {/*    ));*/}
      {/*  }}*/}
      {/*  onAutoCreateErrors={handleAutoCreateErrors}*/}
      {/*/>*/}

      {/* Main Content */}
      <SidebarInset className="flex flex-col">
        {/* Header with trigger */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="bg-background rounded-lg shadow-lg hover:bg-accent z-50 h-9 w-9 border" />
        </header>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
          style={{
            cursor: selectedTool === 'move' ? (isPanning ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {/* Canvas content */}
          <div
            className="absolute inset-0 "
            style={{
              transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {showGrid && <Grid zoom={zoom} viewportOffset={viewportOffset} />}
            {paths.map(renderPath)}
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const rowNodes = nodes.slice(virtualRow.index * 3, (virtualRow.index + 1) * 3);
              return rowNodes.map(renderNode);
            })}
            {drawing && startNode && (
              <svg className="absolute inset-0 pointer-events-none">
                <line
                  x1={startNode.x}
                  y1={startNode.y}
                  x2={lastMousePos.current.x - viewportOffset.x}
                  y2={lastMousePos.current.y - viewportOffset.y}
                  stroke="black"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Floating Controls */}
        {showControls && <FloatingControls />}
      </SidebarInset>
    </SidebarProvider>
  );
}
