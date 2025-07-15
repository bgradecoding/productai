import React from "react";

const ComponentPalette: React.FC = () => {
  const components = [
    { name: "Header", icon: "📄", color: "bg-blue-500" },
    { name: "Button", icon: "🔘", color: "bg-green-500" },
    { name: "Input", icon: "📝", color: "bg-purple-500" },
    { name: "Text", icon: "📄", color: "bg-gray-500" },
    { name: "Image", icon: "🖼️", color: "bg-pink-500" },
    { name: "Card", icon: "🃏", color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {components.map((component) => (
          <div
            key={component.name}
            className="group cursor-grab active:cursor-grabbing"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/reactflow", component.name.toLowerCase());
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            <div className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200 group-hover:scale-105">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 ${component.color} rounded-lg flex items-center justify-center text-white text-lg`}
                >
                  {component.icon}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {component.name}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentPalette;
