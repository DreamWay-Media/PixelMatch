import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Comparison } from '@shared/schema';
import { Clock, FileText, AlertCircle } from "lucide-react";

interface ProjectComparisonsProps {
  projectId: number;
  onSelectComparison: (comparisonId: number) => void;
}

export default function ProjectComparisons({ projectId, onSelectComparison }: ProjectComparisonsProps) {
  // Fetch comparisons for this project
  const { data: comparisons, isLoading } = useQuery<Comparison[]>({
    queryKey: [`/api/projects/${projectId}/comparisons`],
    enabled: !!projectId,
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">No comparison reports found. Create your first report.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium mb-4">Comparison History</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {comparisons.map(comparison => (
          <Card 
            key={comparison.id} 
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectComparison(comparison.id)}
          >
            <div className="relative h-40 bg-gray-100 overflow-hidden">
              <img 
                src={`/${comparison.websiteImagePath.startsWith('/') ? comparison.websiteImagePath.substring(1) : comparison.websiteImagePath}`} 
                alt={comparison.name || 'Website comparison'} 
                className="object-cover w-full h-full"
                onError={(e) => {
                  // If image fails to load, use a fallback
                  console.log('Image failed to load:', comparison.websiteImagePath);
                  const target = e.target as HTMLImageElement;
                  target.src = '/uploads/placeholder.png';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <Badge variant={comparison.status === 'completed' ? 'default' : 'outline'}>
                  {comparison.status === 'completed' ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            </div>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-md">{comparison.name}</CardTitle>
              <CardDescription className="flex items-center text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(comparison.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex justify-between">
                <div className="flex items-center text-xs text-gray-500">
                  <FileText className="h-3 w-3 mr-1" />
                  Report
                </div>
                <Button variant="ghost" size="sm" className="h-6 px-2">View</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}