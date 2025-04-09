interface FooterProps {
  isLoading: boolean;
  activeTab?: { type: string };
  rowCount: number;
}

const Footer = (props: FooterProps) => {
  const { isLoading, activeTab, rowCount } = props;

  return (
    <div className="h-6 min-h-6 flex-shrink-0 bg-background border-t border-foreground flex items-center px-1 justify-between">
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
    </div>
  );
};

export default Footer;
