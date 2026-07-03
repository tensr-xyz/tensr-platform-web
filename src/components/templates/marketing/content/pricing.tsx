import { MarketingHtml } from '@/components/templates/marketing/components/marketing-html';
import { PRICING_HTML } from '@/components/templates/marketing/content/pricing.html';
import '@/components/templates/marketing/content/pricing.css';

export function PricingContent() {
  return <MarketingHtml html={PRICING_HTML} />;
}
