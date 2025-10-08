import PluginUploadForm from '@/components/templates/plugin-upload';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function PluginUploadPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PluginUploadForm />
    </Suspense>
  );
}
