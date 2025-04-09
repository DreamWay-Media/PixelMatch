import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Project } from '@shared/schema';

// Form schema validation
const formSchema = z.object({
  name: z.string().min(3, { message: 'Report name must be at least 3 characters' }).max(100),
  description: z.string().min(10, { message: 'Description must be at least 10 characters' }).max(500),
  projectId: z.number().positive(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateReportDialogProps {
  projects: Project[];
  projectId?: number;
  onReportCreated?: (comparisonId: number) => void;
}

export default function CreateReportDialog({ 
  projects, 
  projectId, 
  onReportCreated 
}: CreateReportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      projectId: projectId || (projects.length > 0 ? projects[0].id : 0),
    },
  });

  const createReport = useMutation({
    mutationFn: async (data: FormData) => {
      // Create an empty comparison record first
      const res = await apiRequest('POST', `/api/projects/${data.projectId}/comparisons`, {
        name: data.name,
        description: data.description,
        status: 'pending'
      });
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'New report has been created. You can now upload files for comparison.',
      });
      setOpen(false);
      form.reset({
        name: '',
        description: '',
        projectId: projectId || (projects.length > 0 ? projects[0].id : 0),
      });
      
      if (onReportCreated && data.id) {
        onReportCreated(data.id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create report: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    createReport.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Create New Report</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create New Comparison Report</DialogTitle>
          <DialogDescription>
            Create a new report to compare design mockups with website implementation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              placeholder="Enter report name"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this comparison report"
              {...form.register('description')}
              rows={3}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
            )}
          </div>
          
          {projects.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <select
                id="projectId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register('projectId', { 
                  valueAsNumber: true 
                })}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.projectId && (
                <p className="text-sm text-red-500">{form.formState.errors.projectId.message}</p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="submit"
              disabled={createReport.isPending}
            >
              {createReport.isPending ? 'Creating...' : 'Create Report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}