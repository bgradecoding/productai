import React from 'react';
import DraggableComponent from './DraggableComponent';

const ComponentPalette: React.FC = () => {
  const components = ['Header', 'Button', 'Input', 'Text', 'Image', 'Card'];

  return (
    <div className="w-64 p-4 bg-base-200 rounded-box shadow-inner">
      <h3 className="text-lg font-bold mb-4 text-base-content">Components</h3>
      <div className="grid grid-cols-2 gap-2">
        {components.map((name) => (
          <DraggableComponent key={name} id={name}>
            <div className="btn btn-outline btn-primary h-20">
              {name}
            </div>
          </DraggableComponent>
        ))}
      </div>
    </div>
  );
};

export default ComponentPalette;
