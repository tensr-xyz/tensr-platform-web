import PluginPurchase from '@/components/templates/plugin-purchase';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function PluginPurchasePage() {
  return (
    <Suspense fallback={<Loading />}>
      <PluginPurchase />
    </Suspense>
  );
}
