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

  return (
    <div ref={(node) => { setNodeRef(node); (canvasRef as React.MutableRefObject<HTMLDivElement>).current = node; }} className={`w-full h-full relative ${isOver ? 'bg-gray-300' : 'bg-gray-200'}`}>
      {components.map((component) => (
        <DraggableComponent
          key={component.id}
          id={component.id}
          initialPosition={component.position}
        >
          <div
            style={{ width: component.size.width, height: component.size.height }}
            className="border bg-white p-2"
          >
            {component.type}
          </div>
        </DraggableComponent>
      ))}
    </div>
  );
};

export default WireframeCanvas;
