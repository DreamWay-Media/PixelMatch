import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PanelTopDashed, SaveIcon, Share2Icon } from "lucide-react";

interface HeaderProps {
  onSaveReport?: () => void;
  onShare?: () => void;
}

export default function Header({ onSaveReport, onShare }: HeaderProps) {
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
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
