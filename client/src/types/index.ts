import { 
  Project, 
  Comparison, 
  Discrepancy, 
  Comment, 
  Activity, 
  User,
  PriorityType,
  DiscrepancyType,
  StatusType
} from "@shared/schema";

export interface FileWithPreview extends File {
  preview: string;
}

export interface ProjectWithDetails extends Project {
  lastComparedAt?: string;
}

export interface DiscrepancyWithComments extends Discrepancy {
  comments?: Comment[];
}

export interface ComparisonWithDiscrepancies extends Comparison {
  discrepancies?: DiscrepancyWithComments[];
}

export interface ActivityWithUser extends Activity {
  user?: User;
}

export interface Collaborator extends User {
  status: 'online' | 'offline';
}

export interface Coordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: 'rectangle' | 'circle';
}

export type UploadType = 'design' | 'website';
