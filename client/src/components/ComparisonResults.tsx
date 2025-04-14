import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { RefreshCwIcon, DownloadIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon, FilterIcon, MoreVerticalIcon, SendIcon, PlusCircleIcon, ScanIcon, Pencil, Trash2 } from "lucide-react";
import { ComparisonWithDiscrepancies, DiscrepancyWithComments } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";

// Define the schema outside of component to ensure it doesn't change between renders
const discrepancyFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().optional(), // Made description optional with no minimum length
  type: z.enum(["color", "size", "typography", "position", "layout", "other"], {
    required_error: "Please select a discrepancy type",
  }),
  priority: z.enum(["high", "medium", "low"], {
    required_error: "Please select a priority level",
  }),
  coordinates: z.object({
    x: z.number().min(0, { message: "X coordinate must be positive" }),
    y: z.number().min(0, { message: "Y coordinate must be positive" }),
    width: z.number().min(1, { message: "Width must be at least 1" }),
    height: z.number().min(1, { message: "Height must be at least 1" }),
    shape: z.enum(["rectangle", "circle"])
  })
});

// Default form values outside component
const formDefaultValues = {
  title: "",
  description: "",
  type: "other" as const,
  priority: "medium" as const,
  coordinates: {
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    shape: "rectangle" as const
  }
};

interface ComparisonResultsProps {
  comparisonId: number;
}

export default function ComparisonResults({ comparisonId }: ComparisonResultsProps) {
  // Toast notifications
  const { toast } = useToast();
  
  // Query data
  const { data: comparison, isLoading, error, refetch } = useQuery<ComparisonWithDiscrepancies>({
    queryKey: [`/api/comparisons/${comparisonId}`],
    enabled: !!comparisonId,
  });
  
  // Basic UI state
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);
  const [showDesign, setShowDesign] = useState<boolean>(false);
  
  // Modal and drawing state
  const [addDiscrepancyOpen, setAddDiscrepancyOpen] = useState<boolean>(false);
  const [showDesignInModal, setShowDesignInModal] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStartPos, setDrawStartPos] = useState<{x: number, y: number} | null>(null);
  const [tempShape, setTempShape] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editDiscrepancyId, setEditDiscrepancyId] = useState<number | null>(null);
  
  // Form setup
  const form = useForm<z.infer<typeof discrepancyFormSchema>>({
    resolver: zodResolver(discrepancyFormSchema),
    defaultValues: formDefaultValues
  });
  
  // Select the first discrepancy when data loads
  useEffect(() => {
    if (comparison?.discrepancies?.length) {
      setSelectedDiscrepancy(comparison.discrepancies[0].id);
    }
  }, [comparison]);
  
  // Handle showing relevant discrepancies
  const filteredDiscrepancies = comparison?.discrepancies?.filter(discrepancy => {
    if (priorityFilter === "all") return true;
    return discrepancy.priority === priorityFilter;
  }) || [];
  
  // Update form coordinates when drawing changes
  useEffect(() => {
    if (tempShape) {
      form.setValue("coordinates.x", tempShape.x);
      form.setValue("coordinates.y", tempShape.y);
      form.setValue("coordinates.width", tempShape.width);
      form.setValue("coordinates.height", tempShape.height);
    }
  }, [tempShape, form]);
  
  // Reset drawing when dialog closes
  useEffect(() => {
    if (!addDiscrepancyOpen) {
      setTempShape(null);
      setDrawStartPos(null);
      setIsDrawing(false);
    }
  }, [addDiscrepancyOpen]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4 p-6">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !comparison) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4 p-6">
        <div className="text-center text-red-500">
          Error loading comparison results. Please try again.
        </div>
      </div>
    );
  }
  
  // Handlers below - define within the component but after conditional returns
  
  const handleSelectDiscrepancy = (id: number) => {
    setSelectedDiscrepancy(id);
  };
  
  const handleAddComment = async (discrepancyId: number) => {
    if (!newCommentText.trim()) return;
    
    try {
      await apiRequest('POST', `/api/discrepancies/${discrepancyId}/comments`, {
        content: newCommentText,
        userId: 1 // In a real app, this would be the current user's ID
      });
      
      setNewCommentText("");
      refetch();
      
      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully.",
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);
  
  const handleReRunComparison = async () => {
    try {
      toast({
        title: "AI Re-analysis in Progress",
        description: "Our AI is performing a detailed pixel-perfect analysis. This may take a moment.",
      });
      
      const originalComparison = await apiRequest("GET", `/api/comparisons/${comparisonId}`);
      const comparisonData = await originalComparison.json();
      
      const response = await apiRequest(
        "POST", 
        `/api/projects/${comparisonData.projectId}/recompare`, 
        {
          designImagePath: comparisonData.designImagePath,
          websiteImagePath: comparisonData.websiteImagePath,
          originalComparisonId: comparisonId,
          enhancedAnalysis: true,
          detectionThreshold: 0.85,
          includeSemanticAnalysis: true
        }
      );
      
      const newComparisonData = await response.json();
      
      const highPriorityCount = newComparisonData.discrepancies.filter(
        (d: any) => d.priority === "high"
      ).length;
      
      refetch();
      
      toast({
        title: "AI Analysis Complete",
        description: `Found ${newComparisonData.discrepancies.length} discrepancies, including ${highPriorityCount} high priority issues that need your attention.`,
      });
    } catch (error) {
      console.error("Error re-running comparison:", error);
      toast({
        title: "Analysis Error",
        description: "Failed to complete the AI-powered comparison analysis. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleExportReport = () => {
    try {
      if (!comparison) return;
      
      const report = {
        project: comparison.projectId,
        comparisonId: comparison.id,
        generatedAt: new Date().toISOString(),
        websiteImage: comparison.websiteImagePath,
        designImage: comparison.designImagePath,
        discrepancies: filteredDiscrepancies.map(d => ({
          id: d.id,
          title: d.title,
          description: d.description,
          type: d.type,
          priority: d.priority,
          status: d.status,
          comments: d.comments?.map(c => ({
            content: c.content,
            date: c.createdAt
          }))
        }))
      };
      
      const reportJson = JSON.stringify(report, null, 2);
      
      const blob = new Blob([reportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixelmatch-report-${comparison.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "The report has been exported successfully.",
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export the report. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const getTypeClass = (type: string) => {
    switch (type) {
      case "color":
        return "bg-violet-100 text-violet-800";
      case "size":
        return "bg-blue-100 text-blue-800";
      case "typography":
        return "bg-teal-100 text-teal-800";
      case "position":
        return "bg-amber-100 text-amber-800";
      case "layout":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };
  
  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  // Drawing handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showDesignInModal) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    
    setIsDrawing(true);
    setDrawStartPos({ x, y });
    setTempShape({
      x,
      y,
      width: 0,
      height: 0
    });
    
    e.preventDefault();
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStartPos) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = Math.round(e.clientX - rect.left);
    const currentY = Math.round(e.clientY - rect.top);
    
    setTempShape({
      x: Math.min(drawStartPos.x, currentX),
      y: Math.min(drawStartPos.y, currentY),
      width: Math.abs(currentX - drawStartPos.x),
      height: Math.abs(currentY - drawStartPos.y)
    });
    
    e.preventDefault();
  };
  
  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  };
  
  const handleToggleDesignView = (value: boolean) => {
    setShowDesignInModal(value);
    if (value && isDrawing) {
      setIsDrawing(false);
      setDrawStartPos(null);
    }
  };
  
  const handleDeleteDiscrepancy = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/discrepancies/${id}`);
      
      toast({
        title: "Discrepancy Deleted",
        description: "The discrepancy has been successfully deleted.",
      });
      
      // Refresh the data
      refetch();
      
      // If the deleted discrepancy was selected, reset the selection
      if (selectedDiscrepancy === id) {
        setSelectedDiscrepancy(null);
      }
    } catch (error) {
      console.error("Error deleting discrepancy:", error);
      toast({
        title: "Error",
        description: "Failed to delete discrepancy. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleAddDiscrepancy = async (values: z.infer<typeof discrepancyFormSchema>) => {
    try {
      if (!comparison) return;
      
      if (editMode && editDiscrepancyId) {
        // If in edit mode, update the existing discrepancy
        await apiRequest("PATCH", `/api/discrepancies/${editDiscrepancyId}`, {
          ...values,
          status: "open"
        });
        
        toast({
          title: "Discrepancy Updated",
          description: "The discrepancy has been successfully updated.",
        });
        
        // Reset edit mode
        setEditMode(false);
        setEditDiscrepancyId(null);
      } else {
        // If not in edit mode, create a new discrepancy
        const response = await apiRequest("POST", `/api/comparisons/${comparisonId}/discrepancies`, {
          ...values,
          status: "open"
        });
        
        const newDiscrepancy = await response.json();
        setSelectedDiscrepancy(newDiscrepancy.id);
        
        toast({
          title: "Discrepancy Added",
          description: "Manual discrepancy has been successfully added.",
        });
      }
      
      // Reset form and UI
      setAddDiscrepancyOpen(false);
      form.reset(formDefaultValues);
      setTempShape(null);
      
      // Refresh the data
      refetch();
    } catch (error) {
      console.error("Error with discrepancy:", error);
      toast({
        title: "Error",
        description: `Failed to ${editMode ? "update" : "add"} discrepancy. Please try again.`,
        variant: "destructive"
      });
    }
  };
  
  // Main component render
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-800">Comparison Results</h3>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" className="flex items-center" onClick={handleReRunComparison}>
              <RefreshCwIcon className="h-4 w-4 mr-1" />
              Re-run
            </Button>
            <Button variant="outline" size="sm" className="flex items-center" onClick={handleExportReport}>
              <DownloadIcon className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Comparison View */}
        <div className="border-r border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-800">Visual Comparison</h4>
              <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
                {filteredDiscrepancies.length} issues
              </Badge>
              {comparison.usedFallback && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Fallback Mode
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">This comparison used the fallback analysis engine because AI services were unavailable. Manual verification of highlighted areas is recommended.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 mr-2">
                <Label htmlFor="view-mode" className="text-sm text-gray-500">
                  {showDesign ? "Design" : "Website"}
                </Label>
                <Switch
                  id="view-mode"
                  checked={showDesign}
                  onCheckedChange={setShowDesign}
                  aria-label="Toggle between design and website view"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                <ZoomInIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                <ZoomOutIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleResetZoom}>
                <MaximizeIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="comparison-area bg-gray-50 border border-gray-200 rounded-lg overflow-hidden relative" style={{ minHeight: '400px' }}>
            {/* Mock image for comparison view */}
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-gray-400">
                {(showDesign ? comparison.designImagePath : comparison.websiteImagePath) ? (
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}>
                    <img 
                      src={`/${(showDesign ? comparison.designImagePath : comparison.websiteImagePath).startsWith('/') ? 
                        (showDesign ? comparison.designImagePath : comparison.websiteImagePath).substring(1) : 
                        (showDesign ? comparison.designImagePath : comparison.websiteImagePath)}`} 
                      alt={showDesign ? "Design mockup" : "Website implementation"} 
                      className="max-w-full max-h-[400px]"
                      onError={(e) => {
                        console.log('Image failed to load:', showDesign ? comparison.designImagePath : comparison.websiteImagePath);
                        const target = e.target as HTMLImageElement;
                        target.src = '/uploads/no-image.svg';
                      }}
                    />
                    
                    {/* Only show discrepancy markers on website view, not design view */}
                    {!showDesign && filteredDiscrepancies.map(discrepancy => {
                      const coords = discrepancy.coordinates as any;
                      const isSelected = selectedDiscrepancy === discrepancy.id;
                      
                      return (
                        <div 
                          key={discrepancy.id}
                          className={`absolute discrepancy-marker ${isSelected ? 'z-10' : ''}`}
                          style={{
                            top: `${coords.y}px`,
                            left: `${coords.x}px`,
                            width: `${coords.width}px`,
                            height: `${coords.height}px`,
                            borderRadius: coords.shape === 'circle' ? '50%' : '0',
                            boxShadow: isSelected 
                              ? '0 0 0 3px rgba(239, 68, 68, 1)' 
                              : '0 0 0 2px rgba(239, 68, 68, 0.7)',
                            animation: 'pulse 2s infinite'
                          }}
                          onClick={() => handleSelectDiscrepancy(discrepancy.id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p>No {showDesign ? "design" : "website"} image available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Discrepancy List */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-gray-800">Discrepancies</h4>
            <div className="flex items-center space-x-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="All issues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All issues</SelectItem>
                  <SelectItem value="high">High priority</SelectItem>
                  <SelectItem value="medium">Medium priority</SelectItem>
                  <SelectItem value="low">Low priority</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon">
                <FilterIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredDiscrepancies.map(discrepancy => (
              <div 
                key={discrepancy.id}
                className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                  selectedDiscrepancy === discrepancy.id ? 'border-primary-500' : 'border-gray-200'
                }`}
                onClick={() => handleSelectDiscrepancy(discrepancy.id)}
              >
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-800 mb-1">{discrepancy.title}</h5>
                      <p className="text-sm text-gray-600 mb-2">{discrepancy.description}</p>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className={getPriorityClass(discrepancy.priority)}>
                          {discrepancy.priority.charAt(0).toUpperCase() + discrepancy.priority.slice(1)} Priority
                        </Badge>
                        <Badge variant="outline" className={getTypeClass(discrepancy.type)}>
                          {discrepancy.type.charAt(0).toUpperCase() + discrepancy.type.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVerticalIcon className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            // Set form values and edit mode
                            form.reset({
                              title: discrepancy.title,
                              description: discrepancy.description || "",
                              type: discrepancy.type as any,
                              priority: discrepancy.priority as any,
                              coordinates: discrepancy.coordinates as any
                            });
                            
                            // Set temp shape for drawing with existing coordinates
                            if (discrepancy.coordinates) {
                              const coords = discrepancy.coordinates as any;
                              setTempShape({
                                x: coords.x,
                                y: coords.y,
                                width: coords.width,
                                height: coords.height
                              });
                            }
                            
                            setEditMode(true);
                            setEditDiscrepancyId(discrepancy.id);
                            setAddDiscrepancyOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteDiscrepancy(discrepancy.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  {selectedDiscrepancy === discrepancy.id && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      {/* Comments Section */}
                      {discrepancy.comments && discrepancy.comments.length > 0 && (
                        <div className="space-y-2 mb-2">
                          {discrepancy.comments.map(comment => (
                            <div key={comment.id} className="flex items-start space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
                                <AvatarFallback>SL</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 text-xs bg-gray-50 rounded-md p-2">
                                <p className="font-medium text-gray-800">Sarah L.</p>
                                <p className="text-gray-600">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-2 flex items-center space-x-2">
                        <Input 
                          type="text" 
                          placeholder="Add a comment..." 
                          className="text-sm"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(discrepancy.id);
                            }
                          }}
                        />
                        <Button 
                          variant="secondary" 
                          size="icon"
                          onClick={() => handleAddComment(discrepancy.id)}
                        >
                          <SendIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Add Discrepancy Button */}
            <button 
              onClick={() => {
                // Reset form to defaults and ensure we're not in edit mode
                setEditMode(false);
                setEditDiscrepancyId(null);
                form.reset(formDefaultValues);
                setAddDiscrepancyOpen(true);
              }}
              className="w-full bg-white border border-dashed border-gray-300 rounded-lg p-3 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Add manual discrepancy</span>
            </button>
            
            {/* Add Discrepancy Dialog */}
            <Dialog 
              open={addDiscrepancyOpen} 
              onOpenChange={(open) => {
                if (!open) {
                  // Reset form and edit mode when dialog closes
                  setEditMode(false);
                  setEditDiscrepancyId(null);
                  form.reset(formDefaultValues);
                  setTempShape(null);
                }
                setAddDiscrepancyOpen(open);
              }}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editMode ? "Edit Discrepancy" : "Add Manual Discrepancy"}
                  </DialogTitle>
                  <DialogDescription>
                    {editMode 
                      ? "Edit the discrepancy details to update the information."
                      : "Create a manual discrepancy to track issues not detected by AI. Draw directly on the image to specify the location."
                    }
                  </DialogDescription>
                </DialogHeader>
                
                {/* Drawing canvas section - shown in both add and edit modes */}
                <div className="mt-4 mb-6">
                  <div className="border border-gray-200 rounded-lg relative overflow-hidden">
                    {/* View toggle control */}
                    <div className="p-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="modal-view-toggle" className="text-xs text-gray-500">
                          {showDesignInModal ? "Design View" : "Website View"}
                        </Label>
                        <Switch
                          id="modal-view-toggle"
                          checked={showDesignInModal}
                          onCheckedChange={handleToggleDesignView}
                          aria-label="Toggle between design and website view"
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {isDrawing ? 'Drawing...' : editMode ? 'Click and drag to adjust the highlighted area' : 'Click and drag to mark the discrepancy area'}
                      </div>
                    </div>
                    
                    {/* Image drawing area with event handlers from the component */}
                    <div 
                      className="w-full bg-gray-50 flex items-center justify-center"
                      style={{
                        minHeight: '280px',
                        position: 'relative', 
                        userSelect: 'none',
                        cursor: !showDesignInModal ? 'crosshair' : 'default'
                      }}
                      onMouseDown={!showDesignInModal ? handleMouseDown : undefined}
                      onMouseMove={!showDesignInModal ? handleMouseMove : undefined}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      {/* Actual image content */}
                      <div className="relative select-none" style={{ cursor: !showDesignInModal ? 'crosshair' : 'default' }}>
                        {/* Display design image or website image based on toggle */}
                        {comparison ? (
                          showDesignInModal ? (
                            comparison.designImagePath ? (
                              <div className="relative">
                                <img
                                  src={`/${comparison.designImagePath.startsWith('/') ? 
                                    comparison.designImagePath.substring(1) : 
                                    comparison.designImagePath}`}
                                  alt="Design mockup for reference"
                                  className="max-w-full max-h-[280px]"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/uploads/no-image.svg';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-[280px]">
                                <p className="text-gray-400">No design image available</p>
                              </div>
                            )
                          ) : (
                            comparison.websiteImagePath ? (
                              <div className="relative">
                                <img
                                  src={`/${comparison.websiteImagePath.startsWith('/') ? 
                                    comparison.websiteImagePath.substring(1) : 
                                    comparison.websiteImagePath}`}
                                  alt="Website implementation for marking issues"
                                  className="max-w-full max-h-[280px]"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/uploads/no-image.svg';
                                  }}
                                />

                                {/* Drawing Overlay */}
                                {tempShape && (
                                  <div 
                                    className="absolute border-2 border-red-500 bg-red-300 bg-opacity-30 pointer-events-none z-10"
                                    style={{
                                      top: `${tempShape.y}px`,
                                      left: `${tempShape.x}px`,
                                      width: `${tempShape.width}px`,
                                      height: `${tempShape.height}px`
                                    }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-[280px]">
                                <p className="text-gray-400">No website image available</p>
                              </div>
                            )
                          )
                        ) : (
                          <div className="flex items-center justify-center h-[280px]">
                            <p className="text-gray-400">Loading...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Form */}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAddDiscrepancy)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter title..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            Description
                            <span className="text-sm text-muted-foreground">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe the issue (optional)..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select 
                              value={field.value} 
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="color">Color</SelectItem>
                                <SelectItem value="size">Size</SelectItem>
                                <SelectItem value="typography">Typography</SelectItem>
                                <SelectItem value="position">Position</SelectItem>
                                <SelectItem value="layout">Layout</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select 
                              value={field.value} 
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" type="button" onClick={() => setAddDiscrepancyOpen(false)} className="mr-2">
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editMode ? "Update Discrepancy" : "Add Discrepancy"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}