import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from './accepted-upload-types';

describe('accepted upload types', () => {
  it('allows SPSS sav and Stata dta alongside csv/xlsx', () => {
    expect(isAcceptedUploadExtension('wave.sav')).toBe(true);
    expect(isAcceptedUploadExtension('wave.dta')).toBe(true);
    expect(isAcceptedUploadExtension('wave.csv')).toBe(true);
    expect(isAcceptedUploadExtension('wave.xlsx')).toBe(true);
    expect(isAcceptedUploadExtension('wave.exe')).toBe(false);
    expect(ACCEPTED_UPLOAD_ACCEPT).toContain('.sav');
    expect(ACCEPTED_UPLOAD_ACCEPT).toContain('.dta');
    expect(isAcceptedUploadExtension('wave.sss')).toBe(true);
    expect(ACCEPTED_UPLOAD_ACCEPT).toContain('.sss');
  });
});
