import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UploadSection from '@/components/UploadSection';
import ComparisonResults from '@/components/ComparisonResults';
import TeamCollaboration from '@/components/TeamCollaboration';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { ProjectWithDetails } from '@/types';

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeComparisonId, setActiveComparisonId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Fetch projects
  const { data: projects, isLoading: isLoadingProjects } = useQuery<ProjectWithDetails[]>({
    queryKey: ['/api/projects'],
  });

  // Create project mutation
  const createProject = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/projects', { name });
      return await res.json();
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setActiveProjectId(newProject.id);
      
      toast({
        title: 'Project Created',
        description: `"${newProject.name}" has been created successfully.`,
      });
    },
    onError: (error) => {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Initialize with default project if none exists
  useEffect(() => {
    if (!isLoadingProjects && projects && projects.length === 0) {
      createProject.mutate('Homepage Redesign');
    } else if (!isLoadingProjects && projects && projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [isLoadingProjects, projects]);

  // Handle comparison complete
  const handleComparisonComplete = (comparisonId: number) => {
    setActiveComparisonId(comparisonId);
    setShowResults(true);
  };

  // Handle save report
  const handleSaveReport = () => {
    toast({
      title: 'Report Saved',
      description: 'Your report has been saved successfully.',
    });
  };

  // Handle share
  const handleShare = () => {
    toast({
      title: 'Share Link Generated',
      description: 'Share link has been copied to clipboard.',
    });
  };

  if (isLoadingProjects) {
    return (
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const activeProject = projects?.find(project => project.id === activeProjectId);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header 
        onSaveReport={handleSaveReport} 
        onShare={handleShare} 
      />
      
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-7xl mx-auto">
          {/* Project Information */}
          {activeProject && (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{activeProject.name}</h2>
                  <p className="text-sm text-gray-500">
                    {activeProject.lastComparedAt 
                      ? `Last comparison: ${new Date(activeProject.lastComparedAt).toLocaleString()}` 
                      : 'No comparisons yet'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {activeProject.approved && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 flex items-center">
                      <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      QA Approved
                    </Badge>
                  )}
                  
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 flex items-center">
                    <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                    </svg>
                    {activeProject.collaborators || 3} collaborators
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Upload Section */}
          {activeProjectId && !showResults && (
            <UploadSection 
              projectId={activeProjectId} 
              onComparisonComplete={handleComparisonComplete} 
            />
          )}
          
          {/* Comparison Results */}
          {showResults && activeComparisonId && (
            <ComparisonResults comparisonId={activeComparisonId} />
          )}
          
          {/* Team Collaboration */}
          {activeProjectId && (
            <TeamCollaboration projectId={activeProjectId} />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
