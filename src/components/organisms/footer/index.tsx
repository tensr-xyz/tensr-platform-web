import { Button } from '@/components/atoms/button';
import { Terminal } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';

interface FooterProps {
  isLoading: boolean;
  activeTab?: { type: string };
  rowCount: number;
}

const Footer = (props: FooterProps) => {
  const { isLoading, activeTab, rowCount } = props;
  const { terminalOpen, toggleTerminal } = useProjectStore();

  return (
    <div className="h-6 min-h-6 shrink-0 bg-background border-t border-border flex items-center px-1 justify-between">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          activeTab?.type === 'spreadsheet' && (
            <div>
              <span>Total rows: {rowCount.toLocaleString()}</span>
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleTerminal(!terminalOpen)}
          className="h-5 w-5"
          title={terminalOpen ? 'Hide Terminal' : 'Show Terminal'}
        >
          <Terminal className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default Footer;
