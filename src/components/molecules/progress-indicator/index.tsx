import { Card, CardContent } from '@/components/atoms/card';
import { Badge } from '@/components/atoms/badge';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';

interface ExecutionProgress {
  step: number;
  totalSteps: number;
  currentStep: string;
  completed: boolean;
}

interface ProgressIndicatorProps {
  progress: ExecutionProgress;
  command?: string;
}

export function ProgressIndicator({ progress, command }: ProgressIndicatorProps) {
  const getStepIcon = (stepNumber: number, currentStep: number, completed: boolean) => {
    if (completed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (stepNumber === currentStep) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (stepNumber < currentStep) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const steps = ['Processing dataset', 'Running analysis', 'Generating results'];

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Executing Analysis</h3>
            <Badge variant="secondary" className="text-xs">
              Step {progress.step} of {progress.totalSteps}
            </Badge>
          </div>

          {/* Command */}
          {command && (
            <div className="text-sm text-muted-foreground">
              Command: <span className="font-mono">{command}</span>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === progress.step;
              const isCompleted = stepNumber < progress.step || progress.completed;

              return (
                <div
                  key={stepNumber}
                  className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                    isActive ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                >
                  {getStepIcon(stepNumber, progress.step, progress.completed)}
                  <span
                    className={`text-sm ${
                      isActive
                        ? 'font-medium text-blue-700 dark:text-blue-300'
                        : isCompleted
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {step}
                  </span>
                  {isActive && (
                    <Badge variant="outline" className="text-xs">
                      {progress.currentStep}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(progress.step / progress.totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
