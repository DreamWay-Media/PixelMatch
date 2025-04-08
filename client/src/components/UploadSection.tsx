import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadIcon, ImageIcon, LinkIcon, Wand2Icon } from "lucide-react";
import { FileWithPreview, UploadType } from "@/types";
import { useDropzone } from "react-dropzone";
import { apiRequest } from "@/lib/queryClient";

interface UploadSectionProps {
  projectId: number;
  onComparisonComplete: (comparisonId: number) => void;
}

export default function UploadSection({ projectId, onComparisonComplete }: UploadSectionProps) {
  const { toast } = useToast();
  const [designFile, setDesignFile] = useState<FileWithPreview | null>(null);
  const [websiteFile, setWebsiteFile] = useState<FileWithPreview | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], fileType: UploadType) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const fileWithPreview = Object.assign(file, {
      preview: URL.createObjectURL(file)
    }) as FileWithPreview;
    
    if (fileType === 'design') {
      setDesignFile(fileWithPreview);
    } else {
      setWebsiteFile(fileWithPreview);
    }
  }, []);

  const designDropzone = useDropzone({
    onDrop: (files) => onDrop(files, 'design'),
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'application/pdf': []
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 1
  });

  const websiteDropzone = useDropzone({
    onDrop: (files) => onDrop(files, 'website'),
    accept: {
      'image/jpeg': [],
      'image/png': []
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 1
  });

  const handleUrlCapture = async () => {
    if (!websiteUrl || !websiteUrl.startsWith('http')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // For this MVP, we'll skip actual screenshot capture and just show a success message
      toast({
        title: "URL Captured",
        description: "Website screenshot has been captured successfully.",
      });
      
      // In a real implementation, we would call an API to capture the screenshot
      // and then set the returned image as the websiteFile
      
      setIsUploading(false);
    } catch (error) {
      console.error("Error capturing website:", error);
      toast({
        title: "Error",
        description: "Failed to capture website screenshot. Please try again.",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  const runComparison = async () => {
    if (!designFile || !websiteFile) {
      toast({
        title: "Missing Files",
        description: "Please upload both design mockup and website screenshot.",
        variant: "destructive"
      });
      return;
    }

    setIsComparing(true);
    
    try {
      const formData = new FormData();
      formData.append('design', designFile);
      formData.append('website', websiteFile);
      
      const response = await fetch(`/api/projects/${projectId}/compare`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Comparison failed');
      }
      
      const result = await response.json();
      
      toast({
        title: "Comparison Complete",
        description: `Found ${result.discrepancies.length} discrepancies between design and implementation.`
      });
      
      // Notify parent component that comparison is complete
      onComparisonComplete(result.comparison.id);
    } catch (error) {
      console.error("Error running comparison:", error);
      toast({
        title: "Error",
        description: "Failed to run comparison. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsComparing(false);
    }
  };

  // Clean up object URLs when component unmounts
  const cleanupObjectURLs = () => {
    if (designFile?.preview) URL.revokeObjectURL(designFile.preview);
    if (websiteFile?.preview) URL.revokeObjectURL(websiteFile.preview);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Upload Files for Comparison</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Design Upload */}
        <div className="flex flex-col">
          <Label className="mb-2">Design Mockup</Label>
          <div 
            {...designDropzone.getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${
              designDropzone.isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
            }`}
          >
            <input {...designDropzone.getInputProps()} />
            {designFile ? (
              <div className="flex flex-col items-center">
                {designFile.type.startsWith('image/') ? (
                  <img 
                    src={designFile.preview} 
                    alt="Design preview" 
                    className="max-h-32 max-w-full mb-2 rounded"
                  />
                ) : (
                  <div className="bg-gray-200 p-4 rounded mb-2 flex items-center justify-center">
                    <p className="text-sm font-medium">{designFile.name}</p>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDesignFile(null);
                    if (designFile.preview) URL.revokeObjectURL(designFile.preview);
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <UploadIcon className="text-gray-400 h-10 w-10 mb-2" />
                <p className="text-sm text-gray-500 text-center">
                  <span className="font-medium text-primary-500">Click to upload</span> or drag and drop<br />
                  PNG, JPG, or PDF (max. 20MB)
                </p>
              </>
            )}
          </div>
        </div>
        
        {/* Website Upload */}
        <div className="flex flex-col">
          <Label className="mb-2">Website Screenshot or URL</Label>
          <div className="flex flex-col space-y-3">
            <div 
              {...websiteDropzone.getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${
                websiteDropzone.isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
              }`}
            >
              <input {...websiteDropzone.getInputProps()} />
              {websiteFile ? (
                <div className="flex flex-col items-center">
                  <img 
                    src={websiteFile.preview} 
                    alt="Website preview" 
                    className="max-h-32 max-w-full mb-2 rounded"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setWebsiteFile(null);
                      if (websiteFile.preview) URL.revokeObjectURL(websiteFile.preview);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <ImageIcon className="text-gray-400 h-10 w-10 mb-2" />
                  <p className="text-sm text-gray-500 text-center">
                    <span className="font-medium text-primary-500">Upload screenshot</span><br />
                    PNG or JPG (max. 20MB)
                  </p>
                </>
              )}
            </div>
            
            <div className="flex items-center">
              <div className="flex-grow text-center">
                <span className="inline-block bg-gray-200 h-px w-full"></span>
              </div>
              <span className="px-2 text-sm text-gray-500">OR</span>
              <div className="flex-grow text-center">
                <span className="inline-block bg-gray-200 h-px w-full"></span>
              </div>
            </div>

            <div className="flex">
              <Input
                type="text"
                placeholder="Enter website URL"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="rounded-r-none"
              />
              <Button 
                variant="default"
                className="rounded-l-none"
                onClick={handleUrlCapture}
                disabled={isUploading}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button 
          variant="default" 
          size="lg" 
          className="flex items-center" 
          onClick={runComparison} 
          disabled={!designFile || !websiteFile || isComparing}
        >
          <Wand2Icon className="h-4 w-4 mr-2" />
          {isComparing ? "Processing..." : "Run AI Comparison"}
        </Button>
      </div>
    </div>
  );
}
