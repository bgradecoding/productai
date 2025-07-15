import React, { useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  type Connection,
  type Edge,
  type Node,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

// Types
interface Component {
  id: string;
  type: "header" | "button" | "input" | "text" | "image" | "card";
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
  text?: string;
}

interface WireframeCanvasProps {
  components: Component[];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  handleDeleteComponent: (componentId: string) => void;
  handleSelectComponent: (componentId: string) => void;
  selectedComponent: string | null;
  nodes: Node[];
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  edges: Edge[];
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: Connection | Edge) => void;
}

// Custom Node Component
const CustomNode: React.FC<{
  id: string;
  data: any;
  selected: boolean;
}> = ({ id, data, selected }) => {
  const { type, text, onDelete, onSelect } = data;

  const nodeStyle: React.CSSProperties = {
    backgroundColor: "white",
    border: `2px solid ${selected ? "#3B82F6" : "#93C5FD"}`,
    borderRadius: "0.5rem",
    boxShadow: selected
      ? "0 4px 12px rgba(59, 130, 246, 0.2)"
      : "0 2px 8px rgba(0,0,0,0.1)",
    transition: "all 0.2s ease-in-out",
    cursor: "grab",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "0.75rem",
    position: "relative", // For delete button positioning
    width: "100%",
    height: "100%",
  };

  return (
    <div style={nodeStyle} onClick={() => onSelect(id)}>
      <div className="absolute -top-3 -right-3 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium z-10">
        {type}
      </div>

      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="absolute -top-3 -left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium hover:bg-red-600 transition-colors z-10"
        >
          ×
        </button>
      )}

      <div className="text-gray-700 text-sm text-center nodrag">
        {text || type}
      </div>
    </div>
  );
};

const nodeTypes = {
  header: CustomNode,
  button: CustomNode,
  input: CustomNode,
  text: CustomNode,
  image: CustomNode,
  card: CustomNode,
};

// Component size helper (moved from App.tsx for local use)
const getComponentSize = (type: Component["type"]) => {
  switch (type) {
    case "header":
      return { width: 300, height: 60 };
    case "button":
      return { width: 120, height: 40 };
    case "input":
      return { width: 200, height: 40 };
    case "text":
      return { width: 250, height: 80 };
    case "image":
      return { width: 150, height: 100 };
    case "card":
      return { width: 200, height: 120 };
    default:
      return { width: 150, height: 50 };
  }
};

// Component text helper (moved from App.tsx for local use)
const getComponentText = (type: Component["type"]) => {
  switch (type) {
    case "header":
      return "Header";
    case "button":
      return "Button";
    case "input":
      return "Input";
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "card":
      return "Card";
    default:
      return "Component";
  }
};

const WireframeCanvas: React.FC<WireframeCanvasProps> = ({
  canvasRef,
  handleDeleteComponent,
  handleSelectComponent,
  selectedComponent,
  setNodes,
  nodes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  edges,
}) => {
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer?.getData("application/reactflow");

      // check if the dropped element is valid
      if (typeof type === "undefined" || !type) {
        return;
      }

      const reactFlowBounds = canvasRef.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const componentSize = getComponentSize(type as any);

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          type,
          text: getComponentText(type as any),
          properties: {},
          onDelete: handleDeleteComponent,
          onSelect: handleSelectComponent,
          isSelected: false,
        },
        style: {
          width: componentSize.width,
          height: componentSize.height,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [
      canvasRef,
      setNodes,
      handleDeleteComponent,
      handleSelectComponent,
      getComponentSize,
      getComponentText,
    ]
  );

  return (
    <div
      className="reactflow-wrapper h-full w-full"
      ref={canvasRef}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
      >
        <Background />
        <Controls />
        <Panel position="top-left">
          <div className="text-sm text-gray-500">
            Drag components from the left panel onto the canvas.
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default WireframeCanvas;
