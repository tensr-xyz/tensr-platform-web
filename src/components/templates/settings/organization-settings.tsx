'use client';

import { useState } from 'react';
import { Settings, Users, Building2, Mail, Shield } from 'lucide-react';
import { useOrganization } from '@/hooks/api/use-organisation';
import Teams from './teams';
import TeamMembers from './team-members';
import Invitations from './invitations';

type SettingsTab = 'teams' | 'team-members' | 'invitations' | 'members' | 'general';

const tabConfig = [
  {
    id: 'teams' as const,
    label: 'Teams',
    icon: Building2,
    description: 'Create and manage teams',
  },
  {
    id: 'team-members' as const,
    label: 'Team Members',
    icon: Users,
    description: 'Manage team membership',
  },
  {
    id: 'invitations' as const,
    label: 'Invitations',
    icon: Mail,
    description: 'Send and manage invitations',
  },
  {
    id: 'members' as const,
    label: 'Organization Members',
    icon: Shield,
    description: 'Manage organization membership',
  },
  {
    id: 'general' as const,
    label: 'General Settings',
    icon: Settings,
    description: 'Organization preferences',
  },
];

export default function OrganizationSettings() {
  const { activeOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<SettingsTab>('teams');

  if (!activeOrganization) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Please select an organization to view settings.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'teams':
        return <Teams />;
      case 'team-members':
        return <TeamMembers />;
      case 'invitations':
        return <Invitations />;
      case 'members':
        return (
          <div className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Organization Members</h3>
            <p className="text-gray-500">
              This feature is coming soon. Use the Teams and Invitations tabs for now.
            </p>
          </div>
        );
      case 'general':
        return (
          <div className="p-8 text-center">
            <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">General Settings</h3>
            <p className="text-gray-500">
              Organization preferences and branding options will be available here soon.
            </p>
          </div>
        );
      default:
        return <Teams />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage {activeOrganization.name} settings and members
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <nav className="-mb-px flex space-x-8">
              {tabConfig.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                      ${
                        isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white">{renderTabContent()}</div>
      </div>
    </div>
  );
}
