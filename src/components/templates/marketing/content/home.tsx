import { MarketingHtml } from '@/components/templates/marketing/components/marketing-html';
import { HOME_HTML } from '@/components/templates/marketing/content/home.html';
import '@/components/templates/marketing/content/home.css';

export function HomeContent() {
  return <MarketingHtml html={HOME_HTML} />;
}
