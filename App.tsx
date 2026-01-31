import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { SceneCard } from './components/SceneCard';
import { analyzeContext, generateCharacterFrames, checkApiKey, requestApiKey, generateVeoSegment, analyzeFaceFeatures, analyzeSceneFeatures, regenerateSingleFrame, estimateSpeakingDuration } from './services/geminiService';
import { AppState, SceneState, ImageGenerationModel } from './types';
import { Film, Wand2, Layers, AlertTriangle, Key, Cpu, User, AlignLeft } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>({
    step: 'upload',
    config: {
      mainImage: null,
      faceReference: null,
      numFrames: 10,
      selectedModel: 'gemini-3-pro-image-preview',
      poseDescription: '' // Default empty
    },
    scenes: [],
    isApiKeySelected: false
  });

  const [loadingMsg, setLoadingMsg] = useState<string>('');
  const [contextDesc, setContextDesc] = useState<string>('');
  const [faceFeaturesCache, setFaceFeaturesCache] = useState<string>('');
  const [sceneFeaturesCache, setSceneFeaturesCache] = useState<string>('');

  useEffect(() => {
    const initKey = async () => {
      const hasKey = await checkApiKey();
      setState(prev => ({ ...prev, isApiKeySelected: hasKey }));
    };
    initKey();
  }, []);

  const handleKeySelect = async () => {
    await requestApiKey();
    setState(prev => ({ ...prev, isApiKeySelected: true }));
  };

  const handleImageUpload = (key: 'mainImage' | 'faceReference') => (base64: string | null) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, [key]: base64 }
    }));
  };

  const startAnalysisAndGeneration = async () => {
    if (!state.config.mainImage || !state.config.faceReference) return;
    if (!state.isApiKeySelected) {
        await handleKeySelect();
    }

    setState(prev => ({ ...prev, step: 'generating_frames' }));
    
    try {
      const cleanMain = state.config.mainImage.split(',')[1];
      const cleanFace = state.config.faceReference.split(',')[1];
      
      // Step 1: Deep Analysis
      setLoadingMsg('Calling Nano Banana: Analyzing Face Topology...');
      const faceFeatures = await analyzeFaceFeatures(cleanFace);
      setFaceFeaturesCache(faceFeatures);
      
      setLoadingMsg('Calling Nano Banana: Analyzing Scene Lighting & Lens...');
      const sceneFeatures = await analyzeSceneFeatures(cleanMain);
      setSceneFeaturesCache(sceneFeatures);

      // Step 2: Synthesis Description
      setContextDesc(`Scene: ${sceneFeatures}. Face: ${faceFeatures}`);
      
      setLoadingMsg(`Generating 4K Keyframes using ${state.config.selectedModel === 'gemini-3-pro-image-preview' ? 'Gemini 3 Pro' : 'Gemini 2.5'}...`);

      // Step 3: Generate Frames 
      // CRITICAL: We pass cleanMain/cleanFace. 
      // The service now generates 9 frames. We prepend cleanMain as Frame 0.
      const generatedFrames = await generateCharacterFrames(
        cleanMain, 
        cleanFace, 
        sceneFeatures, 
        faceFeatures, 
        state.config.poseDescription, // Pass the new pose constraint
        9,
        state.config.selectedModel
      );
      
      const allFrames = [cleanMain, ...generatedFrames];
      
      if (allFrames.length < 2) {
        throw new Error("Failed to generate enough frames.");
      }

      // Step 4: Create Scenes
      const newScenes: SceneState[] = [];
      for (let i = 0; i < allFrames.length - 1; i++) {
        newScenes.push({
          id: crypto.randomUUID(),
          index: i,
          startImage: allFrames[i],
          endImage: allFrames[i+1],
          script: '',
          movementDescription: '', 
          expressionDescription: '', 
          recommendedDuration: null,
          targetResolution: '1080p', // Default
          endFrameActionPrompt: '',
          isRegeneratingImage: false,
          isProcessing: false,
          status: 'idle'
        });
      }

      setState(prev => ({
        ...prev,
        step: 'sequencing',
        scenes: newScenes
      }));

    } catch (error) {
      console.error(error);
      alert("An error occurred during generation. Please try again.");
      setState(prev => ({ ...prev, step: 'upload' }));
    }
  };

  const updateScript = (id: string, text: string) => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, script: text, recommendedDuration: null } : s)
    }));
  };

  const updateMovement = (id: string, text: string) => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, movementDescription: text } : s)
    }));
  };

  const updateExpression = (id: string, text: string) => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, expressionDescription: text } : s)
    }));
  };

  const updateActionPrompt = (id: string, text: string) => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, endFrameActionPrompt: text } : s)
    }));
  };

  const updateResolution = (id: string, resolution: '1080p' | '4k') => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, targetResolution: resolution } : s)
    }));
  };

  const analyzeDuration = async (id: string) => {
     const scene = state.scenes.find(s => s.id === id);
     if (!scene || !scene.script.trim()) return;

     setState(prev => ({
       ...prev,
       scenes: prev.scenes.map(s => s.id === id ? { ...s, isProcessing: true } : s)
     }));

     try {
       const duration = await estimateSpeakingDuration(scene.script);
       setState(prev => ({
         ...prev,
         scenes: prev.scenes.map(s => s.id === id ? { ...s, recommendedDuration: duration, isProcessing: false } : s)
       }));
     } catch (e) {
       setState(prev => ({
         ...prev,
         scenes: prev.scenes.map(s => s.id === id ? { ...s, isProcessing: false } : s)
       }));
     }
  };

  const regenerateEndFrame = async (id: string) => {
    const sceneIndex = state.scenes.findIndex(s => s.id === id);
    if (sceneIndex === -1) return;
    const scene = state.scenes[sceneIndex];

    if (!scene.endFrameActionPrompt.trim()) return;

    // Set loading state
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, isRegeneratingImage: true } : s)
    }));

    try {
      const cleanMain = state.config.mainImage!.split(',')[1];
      const cleanFace = state.config.faceReference!.split(',')[1];

      // Regenerate the end frame with selected model AND global pose constraint
      const newImage = await regenerateSingleFrame(
          cleanMain,
          cleanFace,
          scene.endFrameActionPrompt,
          sceneFeaturesCache,
          faceFeaturesCache,
          state.config.selectedModel,
          state.config.poseDescription // Pass Global Constraint
      );

      if (newImage) {
        // Update CURRENT scene's end image AND NEXT scene's start image to maintain chain
        setState(prev => {
          const updatedScenes = [...prev.scenes];
          
          // Update current scene
          updatedScenes[sceneIndex] = {
            ...updatedScenes[sceneIndex],
            endImage: newImage,
            isRegeneratingImage: false,
            // Invalidate video since images changed
            generatedVideoUrl: undefined,
            status: 'idle'
          };

          // Update next scene if it exists
          if (sceneIndex + 1 < updatedScenes.length) {
            updatedScenes[sceneIndex + 1] = {
              ...updatedScenes[sceneIndex + 1],
              startImage: newImage,
              generatedVideoUrl: undefined, // Invalidate next video too
              status: 'idle'
            };
          }
          return { ...prev, scenes: updatedScenes };
        });
      } else {
        throw new Error("Failed to regenerate image");
      }

    } catch (e) {
      console.error(e);
      alert("Failed to regenerate image. Try again.");
      setState(prev => ({
        ...prev,
        scenes: prev.scenes.map(s => s.id === id ? { ...s, isRegeneratingImage: false } : s)
      }));
    }
  };

  const generateVideo = async (id: string) => {
    const scene = state.scenes.find(s => s.id === id);
    if (!scene) return;
    
    if (!state.isApiKeySelected) {
        await handleKeySelect();
    }

    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { 
          ...s, 
          status: 'generating_video', 
          errorMessage: undefined,
      } : s)
    }));

    try {
      // Pass all the new director controls
      const videoUrl = await generateVeoSegment(
          scene.startImage, 
          scene.endImage, 
          {
            movement: scene.movementDescription,
            expression: scene.expressionDescription,
            script: scene.script,
            context: contextDesc
          },
          scene.targetResolution // Pass the selected resolution ('1080p' or '4k')
      );
      
      if (!videoUrl) throw new Error("Video generation returned no URL");

      setState(prev => ({
        ...prev,
        scenes: prev.scenes.map(s => s.id === id ? { 
          ...s, 
          status: 'complete', 
          generatedVideoUrl: videoUrl 
        } : s)
      }));

    } catch (error) {
      console.error(error);
      setState(prev => ({
        ...prev,
        scenes: prev.scenes.map(s => s.id === id ? { 
          ...s, 
          status: 'error', 
          errorMessage: 'Veo generation failed. Ensure billing is enabled.' 
        } : s)
      }));
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-[#0f0f11]">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Film className="text-purple-500" />
            <span className="font-bold text-xl tracking-tight">Veo Storyweaver <span className="text-purple-500">Pro</span></span>
          </div>
          <div className="flex items-center gap-4">
             {!state.isApiKeySelected && (
               <button onClick={handleKeySelect} className="flex items-center gap-2 text-xs bg-yellow-600/20 text-yellow-500 px-3 py-1 rounded border border-yellow-600/50 hover:bg-yellow-600/30 transition">
                  <Key size={12} /> Select API Key
               </button>
             )}
             <div className="text-xs text-gray-500">Powered by Gemini & Veo 3.1</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Step 1: Upload */}
        {state.step === 'upload' && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center space-y-4 mb-12">
               <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                 Vertical Cinema Generator
               </h1>
               <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                 Upload a 9:16 scene and character reference. We generate 4K frames <span className="text-purple-400">locked to your input</span>, 
                 allowing deep control before Veo generation.
               </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-900/40 p-8 rounded-3xl border border-gray-800">
              <ImageUploader 
                label="Environment Reference (9:16)" 
                image={state.config.mainImage}
                onImageUpload={handleImageUpload('mainImage')}
                description="The master shot. Frame 1 will be EXACTLY this image."
              />
              <ImageUploader 
                label="Character Face Reference" 
                image={state.config.faceReference}
                onImageUpload={handleImageUpload('faceReference')}
                description="3-view or clear portrait. Identity will be locked."
              />
            </div>

            <div className="max-w-3xl mx-auto w-full space-y-4">
              
              {/* Global Pose Constraint Input */}
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-2">
                 <div className="flex items-center gap-2 text-gray-200 font-medium">
                    <User size={18} className="text-purple-400"/>
                    Character Pose & Vibe (Core Constraint)
                 </div>
                 <input 
                   type="text"
                   value={state.config.poseDescription}
                   onChange={(e) => setState(prev => ({...prev, config: {...prev.config, poseDescription: e.target.value}}))}
                   placeholder="e.g. Sitting at desk, hands folded, broadcasting style. (Defines the locked posture for all frames)"
                   className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                 />
                 <p className="text-xs text-gray-500">
                   Tip: Describe the exact posture (sitting/standing) to prevent the AI from defaulting to standing.
                 </p>
              </div>

              {/* Model Selector */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Cpu size={16} className="text-purple-400"/>
                    Image Generation Model
                 </div>
                 <select 
                   value={state.config.selectedModel}
                   onChange={(e) => setState(prev => ({...prev, config: {...prev.config, selectedModel: e.target.value as ImageGenerationModel}}))}
                   className="bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-2 text-sm focus:border-purple-500 focus:outline-none flex-1 w-full sm:w-auto"
                 >
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro (Recommended - 4K & Logic)</option>
                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (Faster - Nano Banana)</option>
                 </select>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={startAnalysisAndGeneration}
                  disabled={!state.config.mainImage || !state.config.faceReference}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-lg font-semibold py-4 px-10 rounded-full shadow-lg shadow-purple-900/40 transition-all transform hover:scale-105 flex items-center gap-3 w-full sm:w-auto justify-center"
                >
                  <Wand2 size={20} />
                  Generate 4K Storyboard
                </button>
              </div>

            </div>
            
            {!state.isApiKeySelected && (
                 <div className="text-center">
                    <p className="text-yellow-500/80 text-sm flex items-center justify-center gap-2">
                      <AlertTriangle size={14} /> 
                      Note: Using Veo 3.1 requires a billed Google Cloud Project.
                    </p>
                 </div>
            )}
          </div>
        )}

        {/* Step 2: Processing Overlay */}
        {state.step === 'generating_frames' && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center flex-col gap-6">
            <div className="relative w-24 h-24">
               <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-white">Production in Progress</h2>
            <p className="text-purple-400 animate-pulse font-mono">{loadingMsg}</p>
          </div>
        )}

        {/* Step 3: Sequencing */}
        {state.step === 'sequencing' && (
          <div className="animate-fade-in">
             <div className="flex items-center justify-between mb-8">
               <div>
                 <h2 className="text-2xl font-bold text-white mb-2">Vertical Production Timeline</h2>
                 <p className="text-gray-400 text-sm">Fine-tune your keyframes using the text box, then generate video.</p>
               </div>
               <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 flex items-center gap-2">
                 <Layers size={16} className="text-purple-400" />
                 <span className="text-white font-mono">{state.scenes.length} Segments</span>
               </div>
             </div>

             <div className="space-y-2">
               {state.scenes.map((scene) => (
                 <SceneCard 
                    key={scene.id} 
                    scene={scene} 
                    onUpdateScript={updateScript}
                    onUpdateMovement={updateMovement}
                    onUpdateExpression={updateExpression}
                    onUpdateActionPrompt={updateActionPrompt}
                    onUpdateResolution={updateResolution}
                    onAnalyzeDuration={analyzeDuration}
                    onGenerateVideo={(id) => generateVideo(id)}
                    onRegenerateImage={regenerateEndFrame}
                 />
               ))}
             </div>
          </div>
        )}

      </main>
    </div>
  );
}