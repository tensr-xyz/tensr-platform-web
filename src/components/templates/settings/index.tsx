import { Dialog, DialogContent, DialogTrigger } from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { SettingsSidebar } from '@/components/templates/settings/settings-sidebar';

interface SettingsProps {
  trigger?: React.ReactNode;
}

export const Settings = ({ trigger }: SettingsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        asChild
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {trigger || (
          <Button variant="ghost" size="icon" title="Settings" className="h-8">
            <SettingsIcon className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-7xl h-[90vh] bg-foreground overflow-hidden p-0">
        <div className="relative flex w-full h-full overflow-hidden">
          <SettingsSidebar />
        </div>
      </DialogContent>
    </Dialog>
  );
};
