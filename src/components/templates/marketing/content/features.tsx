import { MarketingHtml } from '@/components/templates/marketing/components/marketing-html';
import { FEATURES_HTML } from '@/components/templates/marketing/content/features.html';
import '@/components/templates/marketing/content/features.css';

export function FeaturesContent() {
  return <MarketingHtml html={FEATURES_HTML} />;
}
