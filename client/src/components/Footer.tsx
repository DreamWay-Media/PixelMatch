import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 px-4 py-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} PixelMatch. All rights reserved.</p>
        <div className="flex items-center space-x-4">
          <Button variant="link" size="sm" className="text-xs text-gray-500 hover:text-gray-700 p-0">Help</Button>
          <Button variant="link" size="sm" className="text-xs text-gray-500 hover:text-gray-700 p-0">Privacy</Button>
          <Button variant="link" size="sm" className="text-xs text-gray-500 hover:text-gray-700 p-0">Terms</Button>
        </div>
      </div>
    </footer>
  );
}
