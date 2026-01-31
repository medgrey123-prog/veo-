import { GoogleGenAI, Type } from "@google/genai";
import { ImageGenerationModel } from "../types";

// Helper to ensure we get a fresh instance with the selected key
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const checkApiKey = async (): Promise<boolean> => {
  const win = window as any;
  if (win.aistudio && win.aistudio.hasSelectedApiKey) {
    return await win.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const requestApiKey = async (): Promise<void> => {
  const win = window as any;
  if (win.aistudio && win.aistudio.openSelectKey) {
    await win.aistudio.openSelectKey();
  }
};

/**
 * Step 1A: Analyze Face Features (Nano Banana)
 */
export const analyzeFaceFeatures = async (faceImage: string): Promise<string> => {
  const ai = getAIClient();
  const prompt = `
    Analyze this face (3-view reference) for identity consistency.
    List: Eye shape/color, Nose structure, Lip shape, Jawline, Hair color/style/texture, Skin tone and texture.
    Output a precise "Face ID" description.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: faceImage } },
        { text: prompt }
      ]
    }
  });
  return response.text || "Detailed face reference.";
};

/**
 * Step 1B: Analyze Scene/Environment Features (Nano Banana)
 */
export const analyzeSceneFeatures = async (sceneImage: string): Promise<string> => {
  const ai = getAIClient();
  const prompt = `
    Analyze this Scene Image for photographic reproduction.
    Describe:
    1. Lighting (Direction, Softness/Hardness, Color Temperature).
    2. Environment Details (Background objects, textures, depth of field).
    3. Camera Lens (Focal length estimation, angle, shot scale).
    4. Color Palette.
    5. CRITICAL: Analyze the specific pose/position of the character placeholder if visible (e.g. Sitting, Standing, Leaning).
    
    This description will be used to generate a new image that looks IDENTICAL to this one.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: sceneImage } },
        { text: prompt }
      ]
    }
  });
  return response.text || "Cinematic scene description.";
};

export const analyzeContext = async (sceneDesc: string, faceDesc: string): Promise<string> => {
   return `Scene: ${sceneDesc}\nCharacter: ${faceDesc}`;
};

/**
 * Helper: Estimate Speaking Duration
 */
export const estimateSpeakingDuration = async (script: string): Promise<string> => {
  if (!script || script.trim().length === 0) return "0s";
  
  const ai = getAIClient();
  const prompt = `
    Act as a video director. Read this script: "${script}".
    Calculate the natural speaking duration in seconds for a broadcast/storytelling pace.
    Return ONLY the number of seconds (e.g. "4.5"). Do not add text.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Use flash for quick text analysis
      contents: prompt
    });
    const text = response.text?.trim() || "";
    return text.replace(/[^0-9.]/g, ''); // Extract just the number
  } catch (e) {
    console.error("Duration analysis failed", e);
    return "8"; // Default fallback
  }
};

/**
 * Step 3: Generate 4K, 9:16 Frames with Visual Reference Locking
 */
export const generateCharacterFrames = async (
  sceneImage: string,
  faceImage: string,
  sceneDesc: string,
  faceDesc: string,
  poseDescription: string, 
  count: number = 9,
  model: ImageGenerationModel = 'gemini-3-pro-image-preview'
): Promise<string[]> => {
  const ai = getAIClient();
  
  const promises = Array.from({ length: count }).map(async (_, i) => {
    
    const posePrompt = `
      Task: Generate Frame #${i + 2} of a cinematic sequence.
      
      INPUTS:
      - Image 1 (Provided): The MASTER SCENE REFERENCE.
      - Image 2 (Provided): The CHARACTER FACE ID.
      
      STRICT VISUAL CONSTRAINTS:
      1. BACKGROUND LOCK: The background, lighting, and camera angle MUST be identical to Image 1.
      2. FACE LOCK: The character's face must match Image 2 exactly.
      3. ASPECT RATIO: 9:16 (Vertical).
      
      CORE POSE & VIBE (CRITICAL):
      ${poseDescription || "Match the pose in the reference image exactly. If sitting, stay sitting."}
      
      ACTION INSTRUCTION:
      The character is positioned in the scene of Image 1.
      Do NOT change the core body posture (e.g. if sitting, remain sitting). 
      Only create subtle, natural variations in hand gestures, head tilt, or slight upper body shifts typical of a speaker/presenter.
      Keep the shot scale (distance) identical to Image 1.
      
      Output: 4K High Definition, Photorealistic Image.
    `;

    try {
      const response = await ai.models.generateContent({
        model: model, 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: sceneImage } },
            { inlineData: { mimeType: 'image/jpeg', data: faceImage } },
            { text: posePrompt }
          ]
        },
        config: {
          imageConfig: {
            imageSize: model === 'gemini-3-pro-image-preview' ? "4K" : undefined, 
            aspectRatio: "9:16"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return part.inlineData.data;
        }
      }
      return null;
    } catch (e) {
      console.error("Frame generation failed", e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((f): f is string => f !== null);
};

/**
 * REGENERATE SINGLE FRAME
 */
export const regenerateSingleFrame = async (
  sceneImage: string,
  faceImage: string,
  userActionPrompt: string,
  sceneDesc: string,
  faceDesc: string,
  model: ImageGenerationModel = 'gemini-3-pro-image-preview',
  globalPoseConstraint: string = "" 
): Promise<string | null> => {
  const ai = getAIClient();

  const strictPrompt = `
    Task: Regenerate a specific frame in a sequence based on user input.

    INPUTS:
    - Image 1 (Provided): The MASTER SCENE REFERENCE.
    - Image 2 (Provided): The CHARACTER FACE ID.

    GLOBAL POSE CONSTRAINT: ${globalPoseConstraint}
    USER ACTION REQUEST: "${userActionPrompt}"

    INSTRUCTIONS:
    1. Apply the "USER ACTION REQUEST" to the character.
    2. STRICT BACKGROUND LOCK: The environment, lighting, props, and camera angle MUST match Image 1 EXACTLY. 
    3. STRICT FACE LOCK: The character must look exactly like Image 2.
    4. CORE POSTURE: Maintain the "GLOBAL POSE CONSTRAINT" (e.g. if sitting, stay sitting). Do not stand up unless explicitly asked in User Action.
    5. Aspect Ratio: 9:16 Vertical.
    
    Output: 4K Photorealistic Image.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: sceneImage } },
          { inlineData: { mimeType: 'image/jpeg', data: faceImage } },
          { text: strictPrompt }
        ]
      },
      config: {
        imageConfig: {
          imageSize: model === 'gemini-3-pro-image-preview' ? "4K" : undefined,
          aspectRatio: "9:16"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    return null;
  } catch (e) {
    console.error("Single frame regeneration failed", e);
    throw e;
  }
};

/**
 * GENERATE VEO SEGMENT
 */
export const generateVeoSegment = async (
  startImage: string, 
  endImage: string, 
  directorControls: {
    movement: string;
    expression: string;
    script: string;
    context: string;
  },
  resolution: '1080p' | '4k' = '1080p'
): Promise<string | null> => {
  const ai = getAIClient();
  
  const is4k = resolution === '4k';

  const videoPrompt = `
    Cinematic vertical video (9:16). ${is4k ? 'Ultra High Definition, 4K resolution textures, extremely sharp focus.' : ''}
    
    STRICT DIRECTORIAL INSTRUCTIONS:
    
    1. ACTION / MOVEMENT:
    ${directorControls.movement || "Smooth, natural transition between start and end frames."}
    
    2. CHARACTER EXPRESSION / EMOTION:
    ${directorControls.expression || "Neutral, consistent with context."}
    
    3. DIALOGUE CONTEXT (Lip-sync & Vibe):
    ${directorControls.script ? `Character is saying: "${directorControls.script}"` : "No dialogue."}
    
    4. ATMOSPHERE:
    ${directorControls.context}
    
    Ensure smooth movement and consistent identity.
  `;

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: videoPrompt,
      image: {
        imageBytes: startImage,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        // API currently supports '1080p' max for resolution param. 
        // We use prompt engineering for 4K texture requests.
        resolution: '1080p', 
        aspectRatio: '9:16', 
        lastFrame: {
            imageBytes: endImage,
            mimeType: 'image/jpeg'
        }
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) return null;

    const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Veo generation error:", error);
    throw error;
  }
};