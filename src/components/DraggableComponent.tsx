import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableComponentProps {
  id: string;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ id, children, initialPosition }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
    data: { initialPosition },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="absolute cursor-grab"
    >
      {children}
    </div>
  );
};

export default DraggableComponent;