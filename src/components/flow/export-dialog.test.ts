import { pipelineExportPayload } from '@/components/flow/export-dialog';

describe('pipelineExportPayload', () => {
  it('sends the project id so the study brief can be a context page', () => {
    const body = JSON.parse(
      pipelineExportPayload({
        runIds: ['run-1', 'run-2'],
        style: 'apa',
        includeMethods: true,
        projectId: 'proj-brief',
      })
    );
    expect(body.run_ids).toEqual(['run-1', 'run-2']);
    expect(body.project_id).toBe('proj-brief');
    expect(body.include_methods).toBe(true);
  });

  it('sends an empty project id when the export is not from a project', () => {
    const body = JSON.parse(pipelineExportPayload({ runIds: ['run-1'] }));
    expect(body.project_id).toBe('');
  });
});
