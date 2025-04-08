import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ActivityWithUser, 
  Collaborator, 
  ProjectCollaboratorWithUser 
} from '@/types';
import { 
  HandMetal, 
  MoveHorizontal, 
  FileUpIcon, 
  UserPlusIcon, 
  X, 
  UserPlus2Icon,
  Loader2 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface TeamCollaborationProps {
  projectId: number;
}

export default function TeamCollaboration({ projectId }: TeamCollaborationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState("developer");
  const [addingUser, setAddingUser] = useState(false);

  // Fetch collaborators for this project
  const { data: collaborators, isLoading: isLoadingCollaborators } = useQuery<ProjectCollaboratorWithUser[]>({
    queryKey: [`/api/projects/${projectId}/collaborators`],
    enabled: !!projectId && !!user,
  });

  // Fetch activities for this project
  const { data: activities, isLoading: isLoadingActivities } = useQuery<ActivityWithUser[]>({
    queryKey: [`/api/projects/${projectId}/activities`],
    enabled: !!projectId,
  });
  
  // Add collaborator mutation
  const addCollaborator = useMutation({
    mutationFn: async ({ username, role }: { username: string; role: string }) => {
      // First search if the user exists
      const userRes = await apiRequest('GET', `/api/users/search?username=${username}`);
      if (!userRes.ok) {
        throw new Error("User not found");
      }
      
      const userData = await userRes.json();
      
      // Then add the collaborator
      const res = await apiRequest('POST', `/api/projects/${projectId}/collaborators`, {
        userId: userData.id,
        role,
        status: "active"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add collaborator");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/collaborators`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/activities`] });
      setShowAddDialog(false);
      setNewUsername("");
      setNewRole("developer");
      
      toast({
        title: "Collaborator Added",
        description: "User has been added to the project successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add collaborator. Please try again.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setAddingUser(false);
    }
  });
  
  // Remove collaborator mutation
  const removeCollaborator = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('DELETE', `/api/projects/${projectId}/collaborators/${userId}`);
      if (!res.ok) {
        throw new Error("Failed to remove collaborator");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/collaborators`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/activities`] });
      
      toast({
        title: "Collaborator Removed",
        description: "User has been removed from the project.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove collaborator. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleAddCollaborator = () => {
    if (!newUsername.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }
    
    setAddingUser(true);
    addCollaborator.mutate({ 
      username: newUsername, 
      role: newRole 
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comparison_run':
        return <MoveHorizontal className="text-primary-500 h-4 w-4" />;
      case 'discrepancy_updated':
      case 'discrepancy_added':
        return <HandMetal className="text-green-500 h-4 w-4" />;
      case 'project_created':
      case 'comment_added':
        return <HandMetal className="text-green-500 h-4 w-4" />;
      default:
        return <FileUpIcon className="text-gray-500 h-4 w-4" />;
    }
  };

  const getActivityDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Get display name from username
  const getDisplayName = (username: string) => {
    const parts = username.split('_');
    if (parts.length > 0) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return username;
  };

  // Get initials from username
  const getInitials = (username: string) => {
    const parts = username.split('_');
    if (parts.length > 0) {
      return parts[0].charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Get avatar image based on username (mock implementation)
  const getAvatarSrc = (username: string) => {
    if (username === 'sarah_designer') {
      return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";
    } else if (username === 'tom_developer') {
      return "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";
    } else if (username === 'mark_qa') {
      return "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";
    }
    return "";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Team & Collaboration</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Members */}
        <div className="col-span-1">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Collaborators</h4>
            <Badge>{collaborators ? collaborators.length : 0}</Badge>
          </div>
          
          <div className="space-y-3">
            {isLoadingCollaborators ? (
              <div className="py-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">Loading collaborators...</p>
              </div>
            ) : collaborators && collaborators.length > 0 ? (
              (collaborators || []).map(collab => (
                <div key={`${collab.projectId}_${collab.userId}`} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getAvatarSrc(collab.user.username)} />
                      <AvatarFallback>{getInitials(collab.user.username)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {collab.user.username}
                        {collab.user.id === user?.id && (
                          <span className="ml-1 text-xs text-gray-500">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{collab.role.charAt(0).toUpperCase() + collab.role.slice(1)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      {collab.status.charAt(0).toUpperCase() + collab.status.slice(1)}
                    </Badge>
                    
                    {collab.user.id !== user?.id && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-500"
                        onClick={() => removeCollaborator.mutate(collab.user.id)}
                        disabled={removeCollaborator.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">
                <p>No collaborators yet</p>
              </div>
            )}

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2 border-dashed text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                >
                  <UserPlusIcon className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Add collaborator</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add a collaborator</DialogTitle>
                  <DialogDescription>
                    Invite a user to collaborate on this project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      placeholder="Enter username" 
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="designer">Designer</SelectItem>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="qa">QA</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={handleAddCollaborator}
                    disabled={addingUser}
                  >
                    {addingUser ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus2Icon className="mr-2 h-4 w-4" />
                        Add
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Activity Log */}
        <div className="col-span-1 lg:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Recent Activity</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-gray-700">Activity Log</h5>
                <Badge variant="outline" className="bg-gray-100 text-gray-800">
                  {activities ? activities.length : 0} entries
                </Badge>
              </div>
            </div>
            <div className="divide-y divide-gray-200 max-h-[300px] overflow-y-auto">
              {isLoadingActivities ? (
                <div className="p-3 text-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" />
                  Loading activities...
                </div>
              ) : activities && activities.length > 0 ? (
                (activities || []).map(activity => (
                  <div key={activity.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-start space-x-3">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">
                            {activity.type === 'comparison_run' ? 'AI Analysis' : 'User'}
                          </span> {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{getActivityDate(activity.createdAt.toString())}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500">No recent activities</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
