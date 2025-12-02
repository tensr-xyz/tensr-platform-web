'use client';

import React, { useState } from 'react';
import { MessageSquare, Smile, Meh, Frown } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface FeedbackButtonProps {
  variant?: 'default' | 'icon' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  variant = 'outline',
  size = 'default',
  className = '',
}) => {
  const [topic, setTopic] = useState<FeedbackTopic | ''>('');
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { user, tokens } = useAuth();

  const submitFeedback = async (feedbackData: CreateFeedbackInput) => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.idToken}`,
        },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  };

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
        rating: rating,
        text: feedback.trim(),
      };

      await submitFeedback(feedbackData);

      // Reset form
      setTopic('');
      setFeedback('');
      setRating(null);
      setIsOpen(false);

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback!',
      });
    } catch (error) {
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`rounded-full h-10 ${className}`}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Feedback
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end" sideOffset={10}>
        <div className="grid gap-4">
          <h4 className="font-medium leading-none">Send Feedback</h4>
          <div className="space-y-4">
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFeedback(e.target.value)
              }
              rows={5}
              disabled={isSubmitting}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                How satisfied are you?
              </label>
              <div className="flex justify-between items-center bg-gray-50 p-3 -mx-4 rounded-md">
                <div className="flex space-x-1">
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
                        className={`rounded-full transition-colors ${
                          rating === value
                            ? 'bg-blue-100 border-blue-300'
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => setRating(value)}
                        disabled={isSubmitting}
                      >
                        <Icon
                          className={`h-4 w-4 ${rating === value ? 'text-blue-600' : color}`}
                        />
                      </Button>
                    );
                  })}
                </div>
                <Button
                  onClick={handleSubmit}
                  className="w-auto px-4 py-2"
                  disabled={isSubmitting || !topic || !feedback.trim() || rating === null}
                >
                  {isSubmitting ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

