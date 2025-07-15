import React from 'react';
import DraggableComponent from './DraggableComponent';

const ComponentPalette: React.FC = () => {
  const components = ['Header', 'Button', 'Input', 'Text', 'Image', 'Card'];

  return (
    <div className="w-1/4 p-4 bg-gray-100">
      <h3 className="font-bold mb-4">Components</h3>
      <div className="grid grid-cols-2 gap-2">
        {components.map((name) => (
          <DraggableComponent key={name} id={name}>
            <div className="p-2 border rounded bg-white text-center cursor-pointer">
              {name}
            </div>
          </DraggableComponent>
        ))}
      </div>
    </div>
  );
};

export default ComponentPalette;
