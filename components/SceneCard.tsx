import React from 'react';
import { Play, Sparkles, Video, AlertCircle, Loader2, ArrowUpCircle, RefreshCw, Clapperboard, Smile, MessageSquare, Clock, Settings2 } from 'lucide-react';
import { SceneState } from '../types';

interface SceneCardProps {
  scene: SceneState;
  onUpdateScript: (id: string, text: string) => void;
  onUpdateMovement: (id: string, text: string) => void;
  onUpdateExpression: (id: string, text: string) => void;
  onUpdateActionPrompt: (id: string, text: string) => void;
  onUpdateResolution: (id: string, resolution: '1080p' | '4k') => void;
  onAnalyzeDuration: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  onRegenerateImage: (id: string) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({ 
  scene, 
  onUpdateScript, 
  onUpdateMovement,
  onUpdateExpression,
  onUpdateActionPrompt,
  onUpdateResolution,
  onAnalyzeDuration,
  onGenerateVideo,
  onRegenerateImage
}) => {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden shadow-xl mb-8 transition-all hover:border-gray-600">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-3 border-b border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold text-gray-200">Segment {scene.index + 1}</h3>
        <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded border border-gray-600">
          {scene.recommendedDuration ? `AI Target: ${scene.recommendedDuration}s` : '9:16 Vertical'}
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Visual Flow (Start/End Keyframes) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1 justify-between">
             <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Keyframes (4K)</span>
          </div>
          <div className="flex items-start gap-4 justify-center bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
            {/* Start Frame */}
            <div className="flex flex-col gap-2 items-center">
                <div className="relative group w-28 aspect-[9/16] bg-black rounded-lg overflow-hidden border border-gray-600 shadow-lg">
                   <img src={`data:image/jpeg;base64,${scene.startImage}`} className="w-full h-full object-cover" alt="Start" />
                   <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white">Start</div>
                </div>
                {scene.index === 0 && <span className="text-[10px] text-purple-400 font-medium">Locked to Input</span>}
            </div>
            
            <div className="text-gray-500 flex flex-col items-center gap-1 self-center">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
            
            {/* End Frame & Controls */}
            <div className="flex flex-col gap-3 w-36">
                <div className="relative group w-full aspect-[9/16] bg-black rounded-lg overflow-hidden border border-gray-600 shadow-lg">
                   <img src={`data:image/jpeg;base64,${scene.endImage}`} className={`w-full h-full object-cover transition-opacity ${scene.isRegeneratingImage ? 'opacity-50' : 'opacity-100'}`} alt="End" />
                   <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white">End</div>
                   {scene.isRegeneratingImage && (
                       <div className="absolute inset-0 flex items-center justify-center">
                           <Loader2 className="animate-spin text-purple-500" />
                       </div>
                   )}
                </div>
                
                {/* Regeneration Controls */}
                <div className="flex flex-col gap-2">
                    <input 
                        type="text" 
                        value={scene.endFrameActionPrompt}
                        onChange={(e) => onUpdateActionPrompt(scene.id, e.target.value)}
                        placeholder="New pose? (e.g. Look up)"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:border-purple-500 outline-none placeholder:text-gray-600"
                    />
                    <button 
                        onClick={() => onRegenerateImage(scene.id)}
                        disabled={scene.isRegeneratingImage || !scene.endFrameActionPrompt.trim()}
                        className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-[10px] py-1.5 rounded flex items-center justify-center gap-1 transition"
                    >
                        <RefreshCw size={10} className={scene.isRegeneratingImage ? "animate-spin" : ""} />
                        Regenerate Frame
                    </button>
                </div>
            </div>
          </div>
        </div>

        {/* MIDDLE: Director Controls */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-1 block">Veo Director Controls</label>
          
          <div className="space-y-4 bg-gray-900/30 p-4 rounded-xl border border-gray-700/50 h-full">
            
            {/* 1. Movement */}
            <div className="space-y-1">
               <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clapperboard size={12} className="text-purple-400"/>
                  <span>Action / Body Movement</span>
               </div>
               <textarea
                 value={scene.movementDescription}
                 onChange={(e) => onUpdateMovement(scene.id, e.target.value)}
                 placeholder="Describe body movement between start and end frames."
                 className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-xs text-gray-200 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none h-16"
               />
            </div>

            {/* 2. Expression */}
            <div className="space-y-1">
               <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Smile size={12} className="text-purple-400"/>
                  <span>Facial Expression</span>
               </div>
               <input
                 type="text"
                 value={scene.expressionDescription}
                 onChange={(e) => onUpdateExpression(scene.id, e.target.value)}
                 placeholder="e.g. 'Serious, focused, slight frown'"
                 className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-xs text-gray-200 focus:ring-1 focus:ring-purple-500 focus:outline-none"
               />
            </div>

            {/* 3. Dialogue & Timing */}
            <div className="space-y-1">
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-xs text-gray-400">
                      <MessageSquare size={12} className="text-purple-400"/>
                      <span>Dialogue (Lipsync)</span>
                   </div>
                   
                   {/* AI Timing Button */}
                   <button 
                     onClick={() => onAnalyzeDuration(scene.id)}
                     disabled={!scene.script.trim() || scene.isProcessing}
                     className="text-[10px] bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 transition flex items-center gap-1 disabled:opacity-50"
                   >
                     <Clock size={10} />
                     {scene.isProcessing ? 'Analyzing...' : 'Check Timing'}
                   </button>
               </div>
               
               <textarea
                 value={scene.script}
                 onChange={(e) => onUpdateScript(scene.id, e.target.value)}
                 placeholder="What is the character saying?"
                 className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-xs text-gray-200 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none h-16"
               />
               
               {scene.recommendedDuration && (
                 <div className="text-[10px] text-purple-400 flex items-center gap-1 mt-1 animate-fade-in">
                   <Sparkles size={10} />
                   <span>Estimated video duration: {scene.recommendedDuration}s</span>
                 </div>
               )}
            </div>
            
          </div>
        </div>

        {/* RIGHT: Video Output */}
        <div className="lg:col-span-4 flex flex-col gap-4 border-l border-gray-700 pl-8 border-dashed">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-1 flex justify-between items-center">
            <span>Video Output</span>
            {scene.targetResolution === '4k' && <span className="text-[9px] bg-yellow-600/20 text-yellow-500 border border-yellow-600/40 px-1.5 rounded">Pro Key</span>}
          </label>
          
          <div className="flex-1 bg-black rounded-lg border border-gray-800 flex items-center justify-center relative overflow-hidden min-h-[220px]">
            {scene.generatedVideoUrl ? (
              <video 
                src={scene.generatedVideoUrl} 
                controls 
                className="h-full w-full object-contain max-h-[300px]"
              />
            ) : (
              <div className="text-center p-4">
                {scene.status === 'generating_video' ? (
                  <div className="flex flex-col items-center gap-2 text-purple-400">
                     <Loader2 className="animate-spin" />
                     <span className="text-xs">Directing Veo 3.1...</span>
                  </div>
                ) : (
                  <div className="text-gray-600 text-xs flex flex-col items-center gap-2">
                    <Video size={24} />
                    <span>Ready to Generate</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {/* Resolution Selector */}
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1 border border-gray-700">
               <div className="px-2 text-gray-500"><Settings2 size={14}/></div>
               <select 
                 value={scene.targetResolution}
                 onChange={(e) => onUpdateResolution(scene.id, e.target.value as '1080p' | '4k')}
                 className="bg-transparent text-xs text-white w-full outline-none py-1"
               >
                 <option value="1080p">1080p (Standard)</option>
                 <option value="4k">4K (Ultra - API Key)</option>
               </select>
            </div>

            <button
              onClick={() => onGenerateVideo(scene.id)}
              disabled={scene.isProcessing || scene.status === 'generating_video' || scene.isRegeneratingImage}
              className={`
                w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm
                ${scene.generatedVideoUrl 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {scene.status === 'generating_video' ? 'Generating...' : scene.generatedVideoUrl ? 'Regenerate Video' : `Generate ${scene.targetResolution === '4k' ? '4K' : ''} Video`}
            </button>
          </div>
          
          {scene.errorMessage && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {scene.errorMessage}
            </p>
          )}
        </div>

      </div>
    </div>
  );
};