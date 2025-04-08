import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ActivityWithUser, Collaborator } from '@/types';
import { HandMetal, MoveHorizontal, FileUpIcon, UserPlusIcon } from 'lucide-react';

interface TeamCollaborationProps {
  projectId: number;
}

export default function TeamCollaboration({ projectId }: TeamCollaborationProps) {
  // Mock data for collaborators
  const collaborators: Collaborator[] = [
    {
      id: 1,
      username: "sarah_designer",
      password: "", // We don't expose passwords
      role: "designer",
      status: "online"
    },
    {
      id: 2,
      username: "tom_developer",
      password: "", // We don't expose passwords
      role: "developer",
      status: "offline"
    },
    {
      id: 3,
      username: "mark_qa",
      password: "", // We don't expose passwords
      role: "qa",
      status: "offline"
    }
  ];

  // Fetch activities for this project
  const { data: activities, isLoading: isLoadingActivities } = useQuery<ActivityWithUser[]>({
    queryKey: [`/api/projects/${projectId}/activities`],
    enabled: !!projectId,
  });

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
          <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Collaborators</h4>
          <div className="space-y-3">
            {collaborators.map(collaborator => (
              <div key={collaborator.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getAvatarSrc(collaborator.username)} />
                    <AvatarFallback>{getInitials(collaborator.username)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{getDisplayName(collaborator.username)}</p>
                    <p className="text-xs text-gray-500">{collaborator.role.charAt(0).toUpperCase() + collaborator.role.slice(1)}</p>
                  </div>
                </div>
                <Badge variant="outline" className={collaborator.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {collaborator.status.charAt(0).toUpperCase() + collaborator.status.slice(1)}
                </Badge>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full mt-2 border-dashed text-gray-500 hover:bg-gray-50 flex items-center justify-center">
              <UserPlusIcon className="h-4 w-4 mr-1" />
              <span className="text-sm font-medium">Invite teammate</span>
            </Button>
          </div>
        </div>

        {/* Activity Log */}
        <div className="col-span-1 lg:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Recent Activity</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-gray-700">Activity Log</h5>
                <Button variant="link" size="sm" className="text-xs text-primary-500 hover:text-primary-600 px-0">View all</Button>
              </div>
            </div>
            <div className="divide-y divide-gray-200 max-h-[300px] overflow-y-auto">
              {isLoadingActivities ? (
                <div className="p-3 text-center text-gray-500">Loading activities...</div>
              ) : activities && activities.length > 0 ? (
                activities.map(activity => (
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
