import { FlowNotFound, FlowStatePage } from '@/components/flow/flow-not-found';

export default function NotFound() {
  return (
    <FlowStatePage>
      <FlowNotFound
        title="We can't find that page"
        body="The link may be old, or the page has moved. Your projects are still where you left them."
      />
    </FlowStatePage>
  );
}
