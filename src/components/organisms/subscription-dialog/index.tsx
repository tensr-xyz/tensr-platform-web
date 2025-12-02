// File: components/molecules/subscription-dialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import {
  Users,
  Share2,
  GitBranch,
  Network,
  Headphones,
  Settings,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';

interface PlanCardProps {
  name: string;
  price: string;
  description: string;
  features: Array<{
    icon: any;
    text: string;
  }>;
  recommended: boolean;
  onClick: () => void;
}

const PlanCard = ({ name, price, description, features, recommended, onClick }: PlanCardProps) => {
  return (
    <div
      className={`relative rounded-lg border p-6 shadow-sm transition-all hover:shadow-md ${recommended ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
          Recommended
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-bold">{name}</h3>
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold">${price}</span>
          <span className="ml-1 text-gray-500">/month</span>
        </div>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      </div>

      <ul className="mt-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <feature.icon className="h-5 w-5 text-blue-500 flex-shrink-0 mr-2 mt-0.5" />
            <span className="text-sm">{feature.text}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onClick}
        className={`mt-6 w-full ${recommended ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
      >
        {recommended ? 'Upgrade Now' : 'Select Plan'}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

interface FeatureComparisonProps {
  features: Array<{
    name: string;
    education: string | boolean;
    pro: string | boolean;
    team: string | boolean;
    enterprise?: string | boolean;
  }>;
}

const FeatureComparison = ({ features }: FeatureComparisonProps) => {
  return (
    <div className="mt-4 overflow-hidden border rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Feature
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Free
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pro
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50">
              Team
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {features.map((feature, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{feature.name}</td>
              <td className="px-6 py-4 text-center">
                {feature.education === true ? (
                  <Check className="h-5 w-5 text-green-500 mx-auto" />
                ) : feature.education === '—' ? (
                  <X className="h-5 w-5 text-gray-300 mx-auto" />
                ) : (
                  <span className="text-sm text-gray-500">{feature.education}</span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                {feature.pro === true ? (
                  <Check className="h-5 w-5 text-green-500 mx-auto" />
                ) : feature.pro === '—' ? (
                  <X className="h-5 w-5 text-gray-300 mx-auto" />
                ) : (
                  <span className="text-sm text-gray-500">{feature.pro}</span>
                )}
              </td>
              <td className="px-6 py-4 text-center bg-blue-50">
                {feature.team === true ? (
                  <Check className="h-5 w-5 text-green-500 mx-auto" />
                ) : feature.team === '—' ? (
                  <X className="h-5 w-5 text-gray-300 mx-auto" />
                ) : (
                  <span className="text-sm font-medium text-gray-900">{feature.team}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const SubscriptionDialog = ({ open, onClose, onUpgrade }: SubscriptionDialogProps) => {
  const [view, setView] = useState('plans'); // 'plans' or 'comparison'

  // Team plan features from your provided data
  const teamFeatures = [
    { icon: Users, text: 'Team collaboration (up to 5 users)' },
    { icon: Share2, text: 'Shared workspaces' },
    { icon: GitBranch, text: 'Version control' },
    { icon: Network, text: 'Real-time collaboration' },
    { icon: Headphones, text: 'Dedicated support' },
    { icon: Settings, text: 'Team administration tools' },
  ];

  // Simplified feature table for comparison
  const comparisonFeatures = [
    {
      name: 'Team Members',
      education: '—',
      pro: '—',
      team: 'Up to 5 users',
    },
    {
      name: 'Collaboration Features',
      education: '—',
      pro: '—',
      team: 'Advanced',
    },
    {
      name: 'Version Control',
      education: '—',
      pro: 'Basic',
      team: 'Advanced',
    },
    {
      name: 'Support Level',
      education: 'Community',
      pro: 'Priority',
      team: 'Dedicated',
    },
    {
      name: 'API Access',
      education: '—',
      pro: 'Standard',
      team: 'Advanced',
    },
  ];

  const handleUpgrade = () => {
    onUpgrade();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade to Add Team Members</DialogTitle>
          <DialogDescription>
            You&apos;ve reached the limit of your current plan. Upgrade to add team members and
            access more features.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex justify-center space-x-2 mb-6">
            <Button
              variant={view === 'plans' ? 'default' : 'outline'}
              onClick={() => setView('plans')}
              className="rounded-full"
            >
              Subscription Plans
            </Button>
            <Button
              variant={view === 'comparison' ? 'default' : 'outline'}
              onClick={() => setView('comparison')}
              className="rounded-full"
            >
              Feature Comparison
            </Button>
          </div>

          {view === 'plans' ? (
            <div className="grid md:grid-cols-3 gap-4">
              <PlanCard
                name="Free"
                price="0"
                description="Basic features for individuals"
                features={[
                  { icon: Users, text: 'Single user only' },
                  { icon: Settings, text: 'Basic features' },
                  { icon: Network, text: 'Limited storage' },
                ]}
                recommended={false}
                onClick={onClose}
              />

              <PlanCard
                name="Pro"
                price="15"
                description="Advanced features for power users"
                features={[
                  { icon: Users, text: 'Single user only' },
                  { icon: Network, text: 'API integrations' },
                  { icon: Headphones, text: 'Priority support' },
                  { icon: Settings, text: 'Customizable workspace' },
                ]}
                recommended={false}
                onClick={() => alert('Pro plan selected')}
              />

              <PlanCard
                name="Team"
                price="49"
                description="Everything you need for teamwork"
                features={teamFeatures}
                recommended={true}
                onClick={handleUpgrade}
              />
            </div>
          ) : (
            <FeatureComparison features={comparisonFeatures} />
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Continue with Free Plan
          </Button>
          <Button onClick={handleUpgrade}>Upgrade to Team Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
