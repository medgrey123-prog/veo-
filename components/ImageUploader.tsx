import React, { useCallback } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  image: string | null;
  onImageUpload: (base64: string | null) => void;
  description?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ label, image, onImageUpload, description }) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix for API usage if needed, but here we keep it for preview
        // Pass full string to parent, parent handles stripping if needed for API
        onImageUpload(base64String);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageUpload(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <div 
        className={`
          relative border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-all
          ${image ? 'border-purple-500 bg-gray-900' : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'}
        `}
      >
        {image ? (
          <>
            <img src={image} alt="Uploaded" className="h-full w-full object-contain rounded-lg p-2" />
            <button 
              onClick={handleClear}
              className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="text-center p-6 pointer-events-none">
            <div className="bg-gray-700/50 p-4 rounded-full inline-flex mb-3">
              <Upload className="text-gray-400" size={24} />
            </div>
            <p className="text-gray-400 font-medium">Click to upload image</p>
            {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}
          </div>
        )}
        
        {!image && (
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        )}
      </div>
    </div>
  );
};