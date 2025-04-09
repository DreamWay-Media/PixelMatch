import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCwIcon, DownloadIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon, FilterIcon, MoreVerticalIcon, SendIcon, PlusCircleIcon, ScanIcon } from "lucide-react";
import { ComparisonWithDiscrepancies, DiscrepancyWithComments } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ComparisonResultsProps {
  comparisonId: number;
}

export default function ComparisonResults({ comparisonId }: ComparisonResultsProps) {
  const { toast } = useToast();
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);
  const [showDesign, setShowDesign] = useState<boolean>(false);

  const { data: comparison, isLoading, error, refetch } = useQuery<ComparisonWithDiscrepancies>({
    queryKey: [`/api/comparisons/${comparisonId}`],
    enabled: !!comparisonId,
  });

  useEffect(() => {
    if (comparison?.discrepancies?.length) {
      setSelectedDiscrepancy(comparison.discrepancies[0].id);
    }
  }, [comparison]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4 p-6">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4 p-6">
        <div className="text-center text-red-500">
          Error loading comparison results. Please try again.
        </div>
      </div>
    );
  }

  const filteredDiscrepancies = comparison.discrepancies?.filter(discrepancy => {
    if (priorityFilter === "all") return true;
    return discrepancy.priority === priorityFilter;
  }) || [];

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
  
  // Implement enhanced AI-powered re-run comparison functionality
  const handleReRunComparison = async () => {
    try {
      // Show toast to indicate that the AI analysis is being re-run
      toast({
        title: "AI Re-analysis in Progress",
        description: "Our AI is performing a detailed pixel-perfect analysis. This may take a moment.",
      });
      
      // Fetch the comparison to get the image paths
      const originalComparison = await apiRequest("GET", `/api/comparisons/${comparisonId}`);
      const comparisonData = await originalComparison.json();
      
      // Make API call to re-run the comparison with enhanced AI
      const response = await apiRequest(
        "POST", 
        `/api/projects/${comparisonData.projectId}/recompare`, 
        {
          designImagePath: comparisonData.designImagePath,
          websiteImagePath: comparisonData.websiteImagePath,
          originalComparisonId: comparisonId,
          // Parameters that would be used in a real AI analysis
          enhancedAnalysis: true,
          detectionThreshold: 0.85,
          includeSemanticAnalysis: true
        }
      );
      
      // Get the new comparison data
      const newComparisonData = await response.json();
      
      // Calculate the metrics for better reporting
      const highPriorityCount = newComparisonData.discrepancies.filter(
        (d: any) => d.priority === "high"
      ).length;
      
      // Refetch the current comparison data
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

  // Implement export functionality
  const handleExportReport = () => {
    try {
      if (!comparison) return;
      
      // Create a report object with the comparison details
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
      
      // Convert to JSON string
      const reportJson = JSON.stringify(report, null, 2);
      
      // Create a download blob
      const blob = new Blob([reportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create and trigger a download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixelmatch-report-${comparison.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
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

  // Find the type class for discrepancy badge based on type
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

  // Find the priority class for discrepancy badge
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
                      src={`/${showDesign ? comparison.designImagePath : comparison.websiteImagePath}`} 
                      alt={showDesign ? "Design mockup" : "Website implementation"} 
                      className="max-w-full max-h-[400px]"
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
                      <Button variant="ghost" size="icon">
                        <MoreVerticalIcon className="h-4 w-4 text-gray-400" />
                      </Button>
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
            <button className="w-full bg-white border border-dashed border-gray-300 rounded-lg p-3 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2">
              <PlusCircleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Add manual discrepancy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
