import React, { useState, useRef, useEffect } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import WireframeCanvas from "./components/WireframeCanvas";
import ComponentPalette from "./components/ComponentPalette";
import Editor from "@monaco-editor/react";

// As defined in the PRD
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

const App: React.FC = () => {
  const [mode, setMode] = useState<"text" | "wireframe">("text");
  const [textInput, setTextInput] = useState("");
  const [wireframeData, setWireframeData] = useState<WireframeData>({
    components: [],
    canvas: { width: 1200, height: 800 },
  });
  const [generatedCode, setGeneratedCode] = useState({
    html: "",
    css: "",
    javascript: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<
    "html" | "css" | "javascript"
  >("html");
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    if (event.over && event.over.id === "canvas") {
      const canvasRect = canvasRef.current?.getBoundingClientRect();

      if (active.data.current?.initialPosition) {
        // Existing component moved
        setWireframeData((prev) => ({
          ...prev,
          components: prev.components.map((comp) =>
            comp.id === active.id
              ? {
                  ...comp,
                  position: {
                    x: comp.position.x + delta.x,
                    y: comp.position.y + delta.y,
                  },
                }
              : comp
          ),
        }));
      } else {
        // New component dropped from palette
        if (canvasRect) {
          const dropX =
            (event.activatorEvent as MouseEvent).clientX -
            canvasRect.left +
            delta.x;
          const dropY =
            (event.activatorEvent as MouseEvent).clientY -
            canvasRect.top +
            delta.y;

          const newComponent: Component = {
            id: `${active.id}-${Date.now()}`,
            type: active.id as any,
            position: { x: dropX, y: dropY },
            size: { width: 100, height: 50 }, // Default size, can be made configurable
            properties: {},
          };
          setWireframeData((prev) => ({
            ...prev,
            components: [...prev.components, newComponent],
          }));
        }
      }
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      // This is not a real key, and will not work.
      const anthropic = new Anthropic({
        apiKey: "",
        dangerouslyAllowBrowser: true,
      });
      const prompt =
        mode === "text"
          ? `웹 페이지를 생성해줘. 사용자의 요청은 다음과 같아: "${textInput}". HTML, CSS, JavaScript 코드를 각각 json 형태로 응답해줘. 예를 들어, {"html": "...", "css": "...", "javascript": "..."} 형식으로 말이야.`
          : `와이어프레임 데이터를 기반으로 웹 페이지를 생성해줘. 데이터는 다음과 같아: ${JSON.stringify(
              wireframeData
            )}. HTML, CSS, JavaScript 코드를 각각 json 형태로 응답해줘.`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const code = JSON.parse(response.content[0].text);
      setGeneratedCode(code);
    } catch (err) {
      console.error("Error generating code:", err);
      setError(
        `코드 생성 중 오류가 발생했습니다: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "text" && textInput) {
      const handler = setTimeout(() => {
        handleGenerate();
      }, 500); // 500ms after the user stops typing

      return () => {
        clearTimeout(handler);
      };
    }
  }, [textInput, mode]);

  const handleDownload = () => {
    const codeToDownload = generatedCode[activeCodeTab];
    let filename = `index.${activeCodeTab}`;
    let mimeType = "";

    switch (activeCodeTab) {
      case "html":
        mimeType = "text/html";
        break;
      case "css":
        mimeType = "text/css";
        break;
      case "javascript":
        mimeType = "application/javascript";
        break;
      default:
        mimeType = "text/plain";
    }

    const blob = new Blob([codeToDownload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const srcDoc = `
    <html>
      <body>${generatedCode.html}</body>
      <style>${generatedCode.css}</style>
      <script>${generatedCode.javascript}</script>
    </html>
  `;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen">
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div className="font-bold text-xl">Claude Web Generator</div>
            <div>
              <button
                onClick={() => setMode("text")}
                className={`px-3 py-2 rounded ${
                  mode === "text" ? "bg-gray-700" : ""
                }`}
              >
                텍스트 모드
              </button>
              <button
                onClick={() => setMode("wireframe")}
                className={`px-3 py-2 rounded ${
                  mode === "wireframe" ? "bg-gray-700" : ""
                }`}
              >
                와이어프레임 모드
              </button>
              <button className="px-3 py-2 rounded hover:bg-gray-700">
                설정
              </button>
            </div>
          </div>
        </nav>

        <div className="flex flex-grow">
          <div className="w-1/2 p-4 flex flex-col">
            {mode === "text" ? (
              <textarea
                className="w-full h-full p-2 border rounded"
                placeholder="예시: '로그인 페이지를 만들어 주세요. 이메일과 비밀번호 입력 필드, 로그인 버튼이 필요합니다'"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            ) : (
              <div className="flex h-full">
                <ComponentPalette />
                <WireframeCanvas
                  components={wireframeData.components}
                  canvasRef={canvasRef as React.RefObject<HTMLDivElement>}
                />
              </div>
            )}
            {error && <div className="text-red-500 mt-2">{error}</div>}
            <button
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? "생성 중..." : "생성하기"}
            </button>
          </div>

          <div className="w-1/2 p-4 bg-gray-100 flex flex-col">
            <div className="flex-grow border rounded bg-white mb-4">
              <iframe
                srcDoc={srcDoc}
                title="preview"
                sandbox="allow-scripts"
                width="100%"
                height="100%"
              />
            </div>
            <div className="flex-none">
              <div className="flex border-b border-gray-300">
                <button
                  className={`px-4 py-2 ${
                    activeCodeTab === "html"
                      ? "bg-white border-t border-l border-r rounded-t text-blue-600"
                      : "bg-gray-200 text-gray-700"
                  }`}
                  onClick={() => setActiveCodeTab("html")}
                >
                  HTML
                </button>
                <button
                  className={`px-4 py-2 ${
                    activeCodeTab === "css"
                      ? "bg-white border-t border-l border-r rounded-t text-blue-600"
                      : "bg-gray-200 text-gray-700"
                  }`}
                  onClick={() => setActiveCodeTab("css")}
                >
                  CSS
                </button>
                <button
                  className={`px-4 py-2 ${
                    activeCodeTab === "javascript"
                      ? "bg-white border-t border-l border-r rounded-t text-blue-600"
                      : "bg-gray-200 text-gray-700"
                  }`}
                  onClick={() => setActiveCodeTab("javascript")}
                >
                  JavaScript
                </button>
                <button
                  className="ml-auto px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  onClick={handleDownload}
                >
                  코드 다운로드
                </button>
              </div>
              <div className="border rounded-b rounded-tr h-64">
                <Editor
                  height="100%"
                  language={activeCodeTab}
                  value={generatedCode[activeCodeTab]}
                  onChange={(value) =>
                    setGeneratedCode((prev) => ({
                      ...prev,
                      [activeCodeTab]: value || "",
                    }))
                  }
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default App;
