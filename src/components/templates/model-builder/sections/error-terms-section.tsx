import { Card } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';

export function ErrorTermsSection({ nodes, errorTerms, onUpdateErrorTerm }) {
  // Auto-generate error terms for observed variables
  const handleAutoCreateErrors = () => {
    const observedNodes = nodes.filter(n => n.type === 'observed');
    observedNodes.forEach(node => {
      if (!errorTerms.some(e => e.nodeId === node.id)) {
        onUpdateErrorTerm({
          id: `error-${node.id}`,
          nodeId: node.id,
          variance: 1.0,
        });
      }
    });
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Error Terms</h3>
        <div className="space-y-3">
          {errorTerms.map(term => {
            const node = nodes.find(n => n.id === term.nodeId);
            return (
              <div key={term.id} className="grid grid-cols-2 gap-2 items-center">
                <span className="text-sm text-muted-foreground">{node?.label || 'Unknown'}</span>
                <Input
                  type="number"
                  value={term.variance}
                  onChange={e => {
                    onUpdateErrorTerm({
                      ...term,
                      variance: parseFloat(e.target.value),
                    });
                  }}
                  className="text-sm"
                />
              </div>
            );
          })}

          <Button onClick={handleAutoCreateErrors} variant="outline" className="w-full mt-4">
            Auto-Create Error Terms
          </Button>
        </div>
      </Card>
    </div>
  );
}
