import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import DraggableComponent from './DraggableComponent';

interface Component {
  id: string;
  type: 'header' | 'button' | 'input' | 'text' | 'image' | 'card';
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
  text?: string;
}

interface WireframeCanvasProps {
  components: Component[];
  canvasRef: React.RefObject<HTMLDivElement>;
}

const WireframeCanvas: React.FC<WireframeCanvasProps> = ({ components, canvasRef }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'canvas',
  });

  const style: React.CSSProperties = {
    backgroundImage: `
      linear-gradient(to right, #e0e0e0 1px, transparent 1px),
      linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
    `,
    backgroundSize: '20px 20px',
    backgroundColor: isOver ? 'var(--fallback-b2, oklch(var(--b2) / 0.2))' : 'var(--fallback-b1, oklch(var(--b1) / 1))',
    transition: 'background-color 0.2s ease-in-out',
  };

  return (
    <div ref={(node) => { setNodeRef(node); if(canvasRef) (canvasRef as React.MutableRefObject<HTMLDivElement>).current = node; }} className="w-full h-full relative rounded-box" style={style}>
      {components.map((component) => (
        <DraggableComponent
          key={component.id}
          id={component.id}
          initialPosition={component.position}
        >
          <div
            style={{ width: component.size.width, height: component.size.height }}
            className="card bg-base-100 shadow-xl border-2 border-primary flex items-center justify-center"
          >
            <span className="font-bold text-primary-content bg-primary px-2 py-1 rounded-full text-xs absolute -top-3 -right-3">{component.type}</span>
            <div className="text-base-content p-2">{component.text || component.type}</div>
          </div>
        </DraggableComponent>
      ))}
    </div>
  );
};

export default WireframeCanvas;
