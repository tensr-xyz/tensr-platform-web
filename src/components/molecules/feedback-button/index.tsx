'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, Smile, Meh, Frown } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Textarea } from '@/components/atoms/text-area';
import { CreateFeedbackInput, FeedbackTopic } from '@/types/feedback';
import useAuth from '@/hooks/api/use-auth';
import { toast } from '@/hooks/ui/use-toast';
import { getSessionJwt, getSessionToken } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';

async function submitFeedbackRequest(feedbackData: CreateFeedbackInput) {
  const response = await fetch(tensrApiUrl('/feedback'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSessionJwt() || getSessionToken()}`,
    },
    body: JSON.stringify(feedbackData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [topic, setTopic] = useState<FeedbackTopic | ''>('');
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (!open) {
      setTopic('');
      setFeedback('');
      setRating(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to submit feedback.',
        variant: 'destructive',
      });
      return;
    }

    if (!topic || !feedback.trim() || rating === null) {
      toast({
        title: 'Validation Error',
        description: 'Please select a topic, provide feedback, and choose a rating.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData: CreateFeedbackInput = {
        userId: user.userId,
        topic: topic as FeedbackTopic,
        rating,
        text: feedback.trim(),
      };

      await submitFeedbackRequest(feedbackData);

      onOpenChange(false);

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback!',
      });
    } catch {
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send feedback
          </DialogTitle>
          <DialogDescription>
            Tell us what&apos;s working, what isn&apos;t, or what you&apos;d like next.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Select onValueChange={value => setTopic(value as FeedbackTopic)} value={topic}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a topic..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FeedbackTopic.BUG}>Bug Report</SelectItem>
              <SelectItem value={FeedbackTopic.FEATURE}>Feature Request</SelectItem>
              <SelectItem value={FeedbackTopic.GENERAL}>General Feedback</SelectItem>
              <SelectItem value={FeedbackTopic.UI}>UI/Design</SelectItem>
              <SelectItem value={FeedbackTopic.UX}>User Experience</SelectItem>
              <SelectItem value={FeedbackTopic.PERFORMANCE}>Performance</SelectItem>
              <SelectItem value={FeedbackTopic.OTHER}>Other</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Your feedback..."
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            rows={5}
            disabled={isSubmitting}
          />

          <div className="space-y-2">
            <span className="text-sm font-medium">How satisfied are you?</span>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3">
              <div className="flex gap-1">
                {[5, 4, 3, 2, 1].map(value => {
                  const Icon = value >= 4 ? Smile : value === 3 ? Meh : Frown;
                  const color =
                    value >= 4
                      ? 'text-green-600'
                      : value === 3
                        ? 'text-yellow-500'
                        : 'text-red-500';
                  return (
                    <Button
                      key={value}
                      variant="ghost"
                      size="icon"
                      type="button"
                      className={`rounded-full ${
                        rating === value ? 'bg-accent ring-1 ring-ring' : ''
                      }`}
                      onClick={() => setRating(value)}
                      disabled={isSubmitting}
                    >
                      <Icon className={`h-4 w-4 ${rating === value ? 'text-foreground' : color}`} />
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !topic || !feedback.trim() || rating === null}
          >
            {isSubmitting ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
