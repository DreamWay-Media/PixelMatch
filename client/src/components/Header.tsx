import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  PanelTopDashed, 
  SaveIcon, 
  Share2Icon, 
  LogOut,
  UserCircle 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import UserProfileDialog from "./UserProfileDialog";

interface HeaderProps {
  onSaveReport?: () => void;
  onShare?: () => void;
}

export default function Header({ onSaveReport, onShare }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Helper function to get initials from username
  const getInitials = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  // Helper function to get display name from username
  const getDisplayName = (username: string) => {
    const parts = username.split('_');
    if (parts.length > 0) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return username;
  };

  // Get avatar image based on role (only as fallback if no profile picture)
  const getAvatarSrc = (role: string) => {
    if (role === 'designer') {
      return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";
    } else if (role === 'developer') {
      return "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";
    } else if (role === 'qa') {
      return "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";
    }
    return "";
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const openProfileDialog = () => {
    setIsProfileOpen(true);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <PanelTopDashed className="text-primary-500" />
        <h1 className="text-xl font-bold text-gray-800">PixelMatch</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <Button onClick={onSaveReport} variant="default" size="sm" className="flex items-center">
          <SaveIcon className="h-4 w-4 mr-1" />
          Save Report
        </Button>
        <Button onClick={onShare} variant="outline" size="sm" className="flex items-center">
          <Share2Icon className="h-4 w-4 mr-1" />
          Share
        </Button>
        
        {user && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {user.profilePicture ? (
                      <AvatarImage src={user.profilePicture} alt={user.username} />
                    ) : (
                      <AvatarImage src={getAvatarSrc(user.role)} alt={user.username} />
                    )}
                    <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getDisplayName(user.username)}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openProfileDialog}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <UserProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
          </>
        )}
      </div>
    </header>
  );
}
