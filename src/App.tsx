import React, { useState, useRef, useEffect, useCallback } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import Editor from "@monaco-editor/react";
import toast, { Toaster } from 'react-hot-toast';

import WireframeCanvas from "./components/WireframeCanvas";
import ComponentPalette from "./components/ComponentPalette";

// Types
interface Component {
  id: string;
  type: "header" | "button" | "input" | "text" | "image" | "card";
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
  text?: string;
}

interface WireframeData {
  components: Component[];
  canvas: {
    width: number;
    height: number;
  };
}

type Mode = "text" | "wireframe";
type CodeTab = "html" | "css" | "javascript";

// Main App Component
const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>("text");
  const [textInput, setTextInput] = useState("");
  const [wireframeData, setWireframeData] = useState<WireframeData>({
    components: [],
    canvas: { width: 1200, height: 800 },
  });
  const [generatedCode, setGeneratedCode] = useState({
    html: "<!-- Your generated HTML will appear here -->",
    css: "/* Your generated CSS will appear here */",
    javascript: "// Your generated JavaScript will appear here",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>("html");

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    toast.loading('Generating code...');

    try {
      const anthropic = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, // Use environment variable
        dangerouslyAllowBrowser: true,
      });

      const prompt =
        mode === "text"
          ? `Create a complete webpage based on the following request: "${textInput}". Please provide the response as a single JSON object with three keys: "html", "css", and "javascript". The HTML should be a full document structure including <!DOCTYPE html>, <html>, <head>, and <body> tags. The CSS should be modern and clean. The JavaScript code should be placed inside the script tag.`
          : `Create a complete webpage based on the following wireframe data: ${JSON.stringify(wireframeData)}. Please provide the response as a single JSON object with three keys: "html", "css", and "javascript". The HTML should be a full document structure including <!DOCTYPE html>, <html>, <head>, and <body> tags.`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText = response.content[0].text;
      const parsedCode = JSON.parse(responseText);

      setGeneratedCode({
        html: parsedCode.html || "",
        css: parsedCode.css || "",
        javascript: parsedCode.javascript || "",
      });
      toast.dismiss();
      toast.success('Code generated successfully!');
    } catch (err) {
      console.error("Error generating code:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.dismiss();
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, wireframeData, mode]);

  // Debounced generation for text mode
  useEffect(() => {
    if (mode === "text" && textInput.trim() !== "") {
      const handler = setTimeout(() => {
        handleGenerate();
      }, 1000); // 1s debounce
      return () => clearTimeout(handler);
    }
  }, [textInput, mode, handleGenerate]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta, over } = event;
    if (!over || over.id !== "canvas") return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    if (active.data.current?.initialPosition) {
      // Move existing component
      setWireframeData(prev => ({
        ...prev,
        components: prev.components.map(comp =>
          comp.id === active.id
            ? { ...comp, position: { x: comp.position.x + delta.x, y: comp.position.y + delta.y } }
            : comp
        ),
      }));
    } else {
      // Drop new component
      const dropPosition = {
        x: (event.activatorEvent as MouseEvent).clientX - canvasRect.left,
        y: (event.activatorEvent as MouseEvent).clientY - canvasRect.top,
      };
      const newComponent: Component = {
        id: `${active.id}-${Date.now()}`,
        type: active.id as any,
        position: dropPosition,
        size: { width: 150, height: 50 },
        properties: {},
        text: `New ${active.id}`
      };
      setWireframeData(prev => ({
        ...prev,
        components: [...prev.components, newComponent],
      }));
    }
  };

  const srcDoc = generatedCode.html.replace('</head>', `<style>${generatedCode.css}</style></head>`).replace('</body>', `<script>${generatedCode.javascript}</script></body>`);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen font-sans" data-theme="bumblebee">
        <Toaster position="bottom-right" />
        {isLoading && (
          <div className="absolute inset-0 bg-base-100 bg-opacity-50 z-50 flex items-center justify-center">
            <span className="loading loading-lg loading-spinner text-primary"></span>
          </div>
        )}

        <Header mode={mode} setMode={setMode} />

        <main className="flex flex-1 overflow-hidden">
          <div className="w-1/3 flex flex-col p-4 gap-4">
            <InputPanel
              mode={mode}
              textInput={textInput}
              setTextInput={setTextInput}
              wireframeData={wireframeData}
              canvasRef={canvasRef}
              handleGenerate={handleGenerate}
              isLoading={isLoading}
            />
          </div>

          <div className="w-2/3 flex flex-col p-4 pl-0 gap-4">
            <PreviewPanel srcDoc={srcDoc} />
            <CodeEditorPanel
              code={generatedCode}
              setCode={setGeneratedCode}
              activeTab={activeCodeTab}
              setActiveTab={setActiveCodeTab}
            />
          </div>
        </main>
      </div>
    </DndContext>
  );
};

// Sub-components
const Header: React.FC<{ mode: Mode; setMode: (mode: Mode) => void }> = ({ mode, setMode }) => (
  <header className="navbar bg-base-100 shadow-md z-10">
    <div className="navbar-start">
        <h1 className="text-2xl font-bold text-primary">Claude Web Generator</h1>
    </div>
    <div className="navbar-center">
        <div className="tabs tabs-boxed">
            <a className={`tab ${mode === 'text' ? 'tab-active' : ''}`} onClick={() => setMode('text')}>Text Mode</a>
            <a className={`tab ${mode === 'wireframe' ? 'tab-active' : ''}`} onClick={() => setMode('wireframe')}>Wireframe Mode</a>
        </div>
    </div>
    <div className="navbar-end">
      <button className="btn btn-ghost btn-circle">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
      </button>
    </div>
  </header>
);

const InputPanel: React.FC<{
  mode: Mode;
  textInput: string;
  setTextInput: (val: string) => void;
  wireframeData: WireframeData;
  canvasRef: React.RefObject<HTMLDivElement>;
  handleGenerate: () => void;
  isLoading: boolean;
}> = ({ mode, textInput, setTextInput, wireframeData, canvasRef, handleGenerate, isLoading }) => (
  <div className="flex flex-col bg-base-100 rounded-box shadow p-4 h-full">
    {mode === 'text' ? (
      <textarea
        className="textarea textarea-bordered w-full flex-grow text-lg"
        placeholder="e.g., 'Create a sleek login page with a dark theme...'"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
      />
    ) : (
      <div className="flex flex-grow gap-4">
        <ComponentPalette />
        <WireframeCanvas components={wireframeData.components} canvasRef={canvasRef} />
      </div>
    )}
    <button
      className="btn btn-primary mt-4"
      onClick={handleGenerate}
      disabled={isLoading}
    >
      {isLoading ? "Generating..." : "Generate Code"}
    </button>
  </div>
);

const PreviewPanel: React.FC<{ srcDoc: string }> = ({ srcDoc }) => (
  <div className="flex-1 bg-base-100 rounded-box shadow overflow-hidden">
    <iframe
      srcDoc={srcDoc}
      title="preview"
      sandbox="allow-scripts allow-same-origin"
      width="100%"
      height="100%"
      className="border-0"
    />
  </div>
);

const CodeEditorPanel: React.FC<{
  code: { html: string; css: string; javascript: string };
  setCode: (code: { html: string; css: string; javascript: string }) => void;
  activeTab: CodeTab;
  setActiveTab: (tab: CodeTab) => void;
}> = ({ code, setCode, activeTab, setActiveTab }) => {
  const handleCodeChange = (value: string | undefined) => {
    setCode({ ...code, [activeTab]: value || '' });
  };

  const handleDownload = () => {
    const blob = new Blob([code[activeTab]], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${activeTab}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col bg-base-100 rounded-box shadow h-1/2">
      <div className="tabs tabs-boxed bg-base-200 p-2">
        {(['html', 'css', 'javascript'] as CodeTab[]).map(tab => (
          <a
            key={tab}
            className={`tab flex-1 ${activeTab === tab ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </a>
        ))}
        <button className="btn btn-sm btn-ghost ml-auto" onClick={handleDownload}>Download</button>
      </div>
      <div className="flex-grow">
        <Editor
          height="100%"
          language={activeTab}
          value={code[activeTab]}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, wordWrap: 'on' }}
        />
      </div>
    </div>
  );
};


export default App;
