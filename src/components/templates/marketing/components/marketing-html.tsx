'use client';

type MarketingHtmlProps = {
  html: string;
};

export function MarketingHtml({ html }: MarketingHtmlProps) {
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
