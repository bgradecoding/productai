import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import Anthropic from "@anthropic-ai/sdk";
import Editor from "@monaco-editor/react";
import toast, { Toaster } from "react-hot-toast";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "reactflow";

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
  const [generatedCode, setGeneratedCode] = useState({
    html: "<!-- Your generated HTML will appear here -->",
    css: "/* Your generated CSS will appear here */",
    javascript: "// Your generated JavaScript will appear here",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>("html");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(
    null
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // onConnect 함수 추가
  const onConnect = useCallback(
    (connection: Connection | Edge) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // 컴포넌트 삭제 함수
  const handleDeleteComponent = useCallback(
    (componentId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== componentId));
      setSelectedComponent(null);
    },
    [setNodes]
  );

  // 컴포넌트 선택 함수
  const handleSelectComponent = useCallback(
    (componentId: string) => {
      setSelectedComponent(componentId);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === componentId
            ? { ...node, selected: true }
            : { ...node, selected: false }
        )
      );
    },
    [setNodes]
  );

  // Helper to convert Component to React Flow Node
  const componentToNode = (comp: Component): Node => ({
    id: comp.id,
    type: comp.type,
    position: comp.position,
    data: {
      ...comp,
      onDelete: handleDeleteComponent,
      onSelect: handleSelectComponent,
      isSelected: false,
    },
    style: {
      width: comp.size.width,
      height: comp.size.height,
    },
  });

  // Helper to convert React Flow Node to Component
  const nodeToComponent = (node: Node): Component => ({
    id: node.id,
    type: node.type as any,
    position: node.position || { x: 0, y: 0 },
    size: {
      width: (node.style?.width as number) || 150,
      height: (node.style?.height as number) || 50,
    },
    properties: node.data?.properties || {},
    text: node.data?.text || "",
  });

  // wireframeData를 nodes에서 계산
  const wireframeData = useMemo(
    () => ({
      components: nodes.map(nodeToComponent),
      canvas: { width: 1200, height: 800 },
    }),
    [nodes]
  );

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    toast.loading("Generating code...");

    try {
      const anthropic = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, // Use environment variable
        dangerouslyAllowBrowser: true,
      });

      const prompt =
        mode === "text"
          ? `Create a complete webpage based on the following request: "${textInput}". Please provide the response as a single JSON object with three keys: "html", "css", and "javascript". The HTML should be a full document structure including <!DOCTYPE html>, <html>, <head>, and <body> tags. The CSS should be modern and clean. The JavaScript code should be placed inside the script tag. IMPORTANT: Respond ONLY with valid JSON, no additional text or explanations.`
          : `Create a complete webpage based on the following wireframe data: ${JSON.stringify(
              wireframeData
            )}. Please provide the response as a single JSON object with three keys: "html", "css", and "javascript". The HTML should be a full document structure including <!DOCTYPE html>, <html>, <head>, and <body> tags. IMPORTANT: Respond ONLY with valid JSON, no additional text or explanations.`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      // 안전한 응답 텍스트 추출
      const responseText =
        response.content[0].type === "text" ? response.content[0].text : "";

      if (!responseText) {
        throw new Error("No response text received from Claude");
      }

      // JSON 파싱 시도
      let parsedCode;
      try {
        // JSON 블록을 찾아서 파싱
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedCode = JSON.parse(jsonMatch[0]);
        } else {
          // 전체 텍스트를 JSON으로 파싱 시도
          parsedCode = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error("JSON parsing error:", parseError);
        console.log("Raw response:", responseText);
        throw new Error(
          "Failed to parse Claude response as JSON. Please try again."
        );
      }

      // 필수 필드 검증
      if (!parsedCode.html && !parsedCode.css && !parsedCode.javascript) {
        throw new Error(
          "Generated code is missing required fields (html, css, javascript)"
        );
      }

      setGeneratedCode({
        html: parsedCode.html || "",
        css: parsedCode.css || "",
        javascript: parsedCode.javascript || "",
      });
      toast.dismiss();
      toast.success("Code generated successfully!");
    } catch (err) {
      console.error("Error generating code:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.dismiss();
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, wireframeData, mode]);

  // 자동 코드 생성 기능 제거 - 버튼 클릭 시에만 실행되도록 변경

  const srcDoc = (() => {
    let html = generatedCode.html;

    // HTML이 기본값인지 확인
    if (html.includes("<!-- Your generated HTML will appear here -->")) {
      return "";
    }

    // CSS 추가
    if (generatedCode.css && !html.includes("<style>")) {
      html = html.replace(
        "</head>",
        `<style>${generatedCode.css}</style></head>`
      );
    }

    // JavaScript 추가
    if (generatedCode.javascript && !html.includes("<script>")) {
      html = html.replace(
        "</body>",
        `<script>${generatedCode.javascript}</script></body>`
      );
    }

    return html;
  })();

  return (
    <div className="flex flex-col h-screen font-sans bg-gradient-to-br from-slate-50 to-blue-50">
      <Toaster position="bottom-right" />
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl shadow-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-lg font-medium text-gray-700">
              Generating your code...
            </p>
          </div>
        </div>
      )}

      <Header mode={mode} setMode={setMode} />

      <main className="flex-1 overflow-hidden p-6">
        <div className="h-full flex gap-6">
          {/* Main Content */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Collapse/Expand Toggle Button */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isCollapsed ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {isCollapsed ? "펼치기" : "접기"}
              </button>
            </div>

            {/* Input Section - Collapsible */}
            {!isCollapsed && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <InputPanel
                  mode={mode}
                  textInput={textInput}
                  setTextInput={setTextInput}
                  wireframeData={wireframeData}
                  canvasRef={canvasRef}
                  handleGenerate={handleGenerate}
                  isLoading={isLoading}
                  setShowPreview={setShowPreview}
                  handleDeleteComponent={handleDeleteComponent}
                  handleSelectComponent={handleSelectComponent}
                  selectedComponent={selectedComponent}
                  setSelectedComponent={setSelectedComponent}
                  nodes={nodes}
                  setNodes={setNodes}
                  edges={edges}
                  setEdges={setEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                />
              </div>
            )}

            {/* Code Editor Section - Always Visible, Expanded when collapsed */}
            <div
              className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${
                isCollapsed ? "flex-1" : "flex-1"
              }`}
            >
              <CodeEditorPanel
                code={generatedCode}
                setCode={setGeneratedCode}
                activeTab={activeCodeTab}
                setActiveTab={setActiveCodeTab}
              />
            </div>

            {/* Action Buttons - Always Visible */}
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium py-3 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating Code...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Generate Code
                  </div>
                )}
              </button>

              <button
                className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center gap-2"
                onClick={() => setShowPreview(true)}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Preview
              </button>
            </div>
          </div>

          {/* Preview Slide Panel */}
          <div
            className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ease-in-out z-50 ${
              showPreview ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800">
                  Live Preview
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex-1">
                <PreviewPanel srcDoc={srcDoc} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Sub-components
const Header: React.FC<{ mode: Mode; setMode: (mode: Mode) => void }> = ({
  mode,
  setMode,
}) => (
  <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
    <div className="max-w-7xl mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Claude Web Generator
            </h1>
            <p className="text-sm text-gray-500">AI-powered web development</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-gray-100 rounded-xl p-1">
            <div className="flex gap-1">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === "text"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setMode("text")}
              >
                Text Mode
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === "wireframe"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setMode("wireframe")}
              >
                Wireframe Mode
              </button>
            </div>
          </div>

          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </header>
);

const InputPanel: React.FC<{
  mode: Mode;
  textInput: string;
  setTextInput: (val: string) => void;
  wireframeData: WireframeData;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  handleGenerate: () => void;
  isLoading: boolean;
  setShowPreview: (show: boolean) => void;
  handleDeleteComponent: (componentId: string) => void;
  handleSelectComponent: (componentId: string) => void;
  selectedComponent: string | null;
  setSelectedComponent: (componentId: string | null) => void;
  nodes: Node[];
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  edges: Edge[];
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: Connection | Edge) => void;
}> = ({
  mode,
  textInput,
  setTextInput,
  wireframeData,
  canvasRef,
  handleGenerate,
  isLoading,
  setShowPreview,
  handleDeleteComponent,
  handleSelectComponent,
  selectedComponent,
  setSelectedComponent,
  nodes,
  setNodes,
  edges,
  setEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-800">
        {mode === "text" ? "Describe Your Website" : "Wireframe Designer"}
      </h3>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-500">Ready</span>
      </div>
    </div>

    {mode === "text" ? (
      <div className="space-y-4 flex-1">
        <textarea
          className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400"
          placeholder="e.g., 'Create a sleek login page with a dark theme, modern animations, and responsive design...'"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
        />
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{textInput.length} characters</span>
          <span>버튼을 클릭하여 코드를 생성하세요</span>
        </div>
      </div>
    ) : (
      <div className="flex-1 flex gap-4">
        <div className="bg-gray-50 rounded-xl p-4 w-1/4">
          <h4 className="font-medium text-gray-700 mb-3">Components</h4>
          <ComponentPalette />
        </div>
        <div className="bg-gray-50 rounded-xl p-4 flex-1">
          <h4 className="font-medium text-gray-700 mb-3">Canvas</h4>
          <div className="h-full min-h-[300px]">
            <WireframeCanvas
              components={wireframeData.components}
              canvasRef={canvasRef}
              handleDeleteComponent={handleDeleteComponent}
              handleSelectComponent={handleSelectComponent}
              selectedComponent={selectedComponent}
              nodes={nodes}
              setNodes={setNodes}
              edges={edges}
              setEdges={setEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
            />
          </div>
        </div>

        {/* 컴포넌트 속성 편집 패널 */}
        {selectedComponent && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-4">
            <ComponentPropertiesPanel
              component={
                wireframeData.components.find(
                  (c) => c.id === selectedComponent
                )!
              }
              onUpdate={(updatedComponent) => {
                setNodes((nds) =>
                  nds.map((node) =>
                    node.id === selectedComponent
                      ? {
                          ...node,
                          data: { ...node.data, ...updatedComponent },
                          position: updatedComponent.position,
                          style: {
                            ...node.style,
                            width: updatedComponent.size.width,
                            height: updatedComponent.size.height,
                          },
                        }
                      : node
                  )
                );
              }}
              onClose={() => setSelectedComponent(null)}
            />
          </div>
        )}
      </div>
    )}
  </div>
);

const PreviewPanel: React.FC<{ srcDoc: string }> = ({ srcDoc }) => {
  // 기본 HTML 템플릿 생성
  const defaultHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Generated Preview</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f8fafc;
            }
            .preview-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                color: #64748b;
                font-size: 18px;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="preview-placeholder">
            <div>
                <h2>미리 보기</h2>
                <p>텍스트를 입력하거나 와이어프레임을 디자인한 후<br>코드를 생성해보세요.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const finalSrcDoc = srcDoc.includes(
    "<!-- Your generated HTML will appear here -->"
  )
    ? defaultHtml
    : srcDoc;

  return (
    <div className="h-full bg-white">
      <iframe
        srcDoc={finalSrcDoc}
        title="preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        width="100%"
        height="100%"
        className="border-0 rounded-b-2xl"
      />
    </div>
  );
};

const CodeEditorPanel: React.FC<{
  code: { html: string; css: string; javascript: string };
  setCode: (code: { html: string; css: string; javascript: string }) => void;
  activeTab: CodeTab;
  setActiveTab: (tab: CodeTab) => void;
}> = ({ code, setCode, activeTab, setActiveTab }) => {
  const handleCodeChange = (value: string | undefined) => {
    setCode({ ...code, [activeTab]: value || "" });
  };

  const handleDownload = () => {
    const blob = new Blob([code[activeTab]], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${activeTab}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1">
          {(["html", "css", "javascript"] as CodeTab[]).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white text-blue-600 shadow-sm border border-gray-200"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          onClick={handleDownload}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download
        </button>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language={activeTab}
          value={code[activeTab]}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
            roundedSelection: false,
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
            },
          }}
        />
      </div>
    </div>
  );
};

// 컴포넌트 속성 편집 패널
const ComponentPropertiesPanel: React.FC<{
  component: Component;
  onUpdate: (component: Component) => void;
  onClose: () => void;
}> = ({ component, onUpdate, onClose }) => {
  const handleTextChange = (text: string) => {
    onUpdate({ ...component, text });
  };

  const handleSizeChange = (size: { width: number; height: number }) => {
    onUpdate({ ...component, size });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700">Component Properties</h4>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          title="Close properties panel"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
            {component.type}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Text
          </label>
          <input
            type="text"
            value={component.text || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter component text..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width
            </label>
            <input
              type="number"
              value={component.size.width}
              onChange={(e) =>
                handleSizeChange({
                  ...component.size,
                  width: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="50"
              max="500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height
            </label>
            <input
              type="number"
              value={component.size.height}
              onChange={(e) =>
                handleSizeChange({
                  ...component.size,
                  height: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="30"
              max="300"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position X
            </label>
            <input
              type="number"
              value={component.position.x}
              onChange={(e) =>
                onUpdate({
                  ...component,
                  position: {
                    ...component.position,
                    x: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position Y
            </label>
            <input
              type="number"
              value={component.position.y}
              onChange={(e) =>
                onUpdate({
                  ...component,
                  position: {
                    ...component.position,
                    y: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
