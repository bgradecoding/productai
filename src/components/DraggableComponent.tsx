import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableComponentProps {
  id: string;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ id, children, initialPosition }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: { initialPosition },
  });

  const style: React.CSSProperties = {
    // If it's a new component from the palette, don't set position until it's dropped.
    // If it's an existing component on the canvas, apply the transform for movement.
    position: initialPosition ? 'absolute' : undefined,
    left: initialPosition ? initialPosition.x : undefined,
    top: initialPosition ? initialPosition.y : undefined,
    transform: CSS.Translate.toString(transform),
    transition: 'box-shadow 0.2s ease-in-out',
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.8 : 1,
    boxShadow: isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={!initialPosition ? '' : 'cursor-grab active:cursor-grabbing'}
    >
      {children}
    </div>
  );
};

export default DraggableComponent;