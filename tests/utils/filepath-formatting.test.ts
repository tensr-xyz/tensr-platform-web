/**
 * Test filePath formatting for collaboration sessions
 */

describe('FilePath Formatting', () => {
  describe('ensureFilePathStartsWithSlash', () => {
    const ensureFilePathStartsWithSlash = (filePath: string): string => {
      return filePath.startsWith('/') ? filePath : `/${filePath}`;
    };

    test('should add leading slash when missing', () => {
      const input = '0062db98-edd9-4388-b077-f9b02724f11d';
      const expected = '/0062db98-edd9-4388-b077-f9b02724f11d';
      expect(ensureFilePathStartsWithSlash(input)).toBe(expected);
    });

    test('should not add leading slash when already present', () => {
      const input = '/0062db98-edd9-4388-b077-f9b02724f11d';
      const expected = '/0062db98-edd9-4388-b077-f9b02724f11d';
      expect(ensureFilePathStartsWithSlash(input)).toBe(expected);
    });

    test('should handle empty string', () => {
      const input = '';
      const expected = '/';
      expect(ensureFilePathStartsWithSlash(input)).toBe(expected);
    });

    test('should handle file paths with multiple segments', () => {
      const input = 'documents/file.xlsx';
      const expected = '/documents/file.xlsx';
      expect(ensureFilePathStartsWithSlash(input)).toBe(expected);
    });

    test('should handle already formatted multi-segment paths', () => {
      const input = '/documents/file.xlsx';
      const expected = '/documents/file.xlsx';
      expect(ensureFilePathStartsWithSlash(input)).toBe(expected);
    });
  });

  describe('Collaboration Session API Call', () => {
    // Mock the filePath formatting logic used in collaboration components
    const formatFilePathForAPI = (filePath: string): string => {
      return filePath.startsWith('/') ? filePath : `/${filePath}`;
    };

    test('should format project ID correctly for API', () => {
      const projectId = '0062db98-edd9-4388-b077-f9b02724f11d';
      const formattedPath = formatFilePathForAPI(projectId);

      expect(formattedPath).toBe('/0062db98-edd9-4388-b077-f9b02724f11d');

      // Verify it matches the expected API format
      const apiPayload = {
        filePath: formattedPath,
        fileName: "NBA Per-Game Stats ('23-24) (1).csv",
        userName: 'oliverdarby99@gmail.com',
      };

      expect(apiPayload.filePath).toMatch(/^\/.+/);
    });

    test('should handle various file path formats', () => {
      const testCases = [
        { input: 'project-123', expected: '/project-123' },
        { input: '/project-123', expected: '/project-123' },
        { input: 'files/document.pdf', expected: '/files/document.pdf' },
        { input: '/files/document.pdf', expected: '/files/document.pdf' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(formatFilePathForAPI(input)).toBe(expected);
      });
    });
  });
});
